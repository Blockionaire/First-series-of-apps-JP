/**
 * Replays labelled items through the REAL buildCandidates + findCluster, the
 * way a discovery run does: one source's feed at a time, each item clustered
 * against the stories that exist at that moment, members oldest first.
 *
 * Shared by tests/clustering-quality.test.mjs and by anyone measuring a
 * change to the clusterer. Returns the predicted story per item and the
 * pairwise error counts against the gold labels.
 */
import * as cluster from "../../src/lib/newsroom/cluster.ts";

export function replay(items, sources, now = Date.parse("2026-09-18T20:00:00.000Z")) {
  const { buildCandidates, findCluster } = cluster;
  // Per-source house terms, from that source's whole feed — what the run has.
  const house = new Map();
  if (cluster.houseTerms) {
    for (const key of new Set(items.map((i) => i.source))) {
      const texts = items.filter((i) => i.source === key).map((i) => ({ title: i.title, lead: i.lead }));
      house.set(key, cluster.houseTerms(texts));
    }
  }

  const stories = [];
  const members = [];
  const predicted = [];
  const reasons = [];
  let clock = now;
  for (const it of items) {
    const ordered = [...members].sort((a, b) =>
      (a.published_at ?? a.retrieved_at).localeCompare(b.published_at ?? b.retrieved_at)
    );
    const src = sources[it.source];
    const match = findCluster(
      { url: it.url, title: it.title, lead: it.lead, publishedAt: it.publishedAt, sourceId: src.id, issuer: src.issuer, boilerplate: house.get(it.source) },
      buildCandidates(stories, ordered),
      now
    );
    const storyId = match?.storyId ?? stories.length + 1;
    if (!match) stories.push({ id: storyId, canonical_title: it.title, last_seen_at: new Date(++clock).toISOString() });
    else stories.find((s) => s.id === storyId).last_seen_at = new Date(++clock).toISOString();
    members.push({
      story_id: storyId, canonical_url: it.url, title: it.title, lead: it.lead,
      published_at: it.publishedAt, retrieved_at: new Date(clock).toISOString(), source_id: src.id, issuer: src.issuer,
    });
    predicted.push(storyId);
    reasons.push(match ? match.reason : "new story");
  }

  let falseMerges = 0, missedMerges = 0, goldPairs = 0, predictedPairs = 0;
  const falseList = [], missedList = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const gold = items[i].story === items[j].story;
      const pred = predicted[i] === predicted[j];
      if (gold) goldPairs++;
      if (pred) predictedPairs++;
      if (pred && !gold) { falseMerges++; falseList.push([items[i].title, items[j].title]); }
      if (gold && !pred) { missedMerges++; missedList.push([items[i].title, items[j].title]); }
    }
  }
  return { predicted, reasons, stories: stories.length, falseMerges, missedMerges, goldPairs, predictedPairs, falseList, missedList };
}
