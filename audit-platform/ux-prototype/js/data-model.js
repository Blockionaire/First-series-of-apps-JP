/* ============================================================================
   data-model.js — the generated audit content.

   Shaped to the real domain types in audit-engine/packages/domain: coverage
   items carry fact statuses, every generated object carries evidence refs and a
   grounding state, and every judgement carries an AI proposal separate from the
   auditor's decision.

   Library ids (RSK-REV-*, CTL-REV-*) and coverage item ids (R1.1 … R12.3) are
   the actual ids from methodology pack `revenue v0.1.0`.

   Headline numbers are never hard-coded — they are computed from this data in
   state.js, so the screens cannot drift from the model.
   ========================================================================== */

/* --- Coverage: 12 sub-processes, 45 coverage items ------------------------- */
/* state: covered | partial | open | na     fact: known | unknown | contradictory | assumed */

const f = (key, status, value) => ({ key, status, value: value || null });

export const subProcesses = [
  { id: "R1", name: "Customer and contract acceptance", items: [
    { id: "R1.1", state: "covered", q: "How does a new customer come into the system, and who controls the master data?", facts: [
      f("customer_acceptance_owner", "known", "Sales administration"),
      f("master_data_creator", "known", "Sales administration (F. El Amrani's team)"),
      f("master_data_approval", "known", "None evidenced — intended four-eyes within the team"),
      f("standing_data_change_control", "unknown"),
    ], refs: ["T:seg-05", "T:seg-07", "Q:5"] },
    { id: "R1.2", state: "covered", q: "How is customer creditworthiness assessed at onboarding?", facts: [
      f("credit_assessment_basis", "known", "Graydon report and payment history"),
      f("credit_limit_setter", "known", "Credit control (I. Molenaar)"),
      f("limit_approval_threshold", "known", "CFO above EUR 250,000"),
    ], refs: ["T:seg-15", "T:seg-17", "D:note-1"] },
    { id: "R1.3", plain: "How the consignment stock held at the German distributor is treated at period end", mandatory: true, state: "partial", q: "What contract terms exist, and who approves anything non-standard?", facts: [
      f("standard_terms_source", "known", "Standard sales conditions; machine terms from the signed quotation"),
      f("non_standard_clause_approver", "known", "Commercial Director above EUR 100,000"),
      f("unusual_terms_types", "known", "Volume rebates (2 OEM customers); consignment stock at one German distributor"),
      f("consignment_period_end_treatment", "unknown"),
    ], refs: ["Q:2", "Q:4", "T:seg-08"] },
    { id: "R1.4", state: "covered", q: "Which revenue streams exist and under which reporting framework are they recognised?", facts: [
      f("revenue_streams", "known", "Machines and spare parts (EUR 41.2m); service contracts (EUR 7.4m)"),
      f("framework_applied", "known", "EU-IFRS, IFRS 15"),
    ], refs: ["T:seg-02", "Q:1"] },
  ]},

  { id: "R2", name: "Order entry", items: [
    { id: "R2.1", state: "covered", q: "Through which channels do orders arrive and where are they first recorded?", facts: [
      f("order_channels", "known", "Signed quotation (machines); e-mail and webshop (spare parts); ServiceTrack (service)"),
      f("order_system", "known", "Dynamics 365 Business Central"),
      f("capture_completeness_control", "known", "None — no reconciliation of the sales mailbox to orders"),
    ], refs: ["T:seg-03", "T:seg-04"] },
    { id: "R2.2", state: "covered", q: "Where does the price on an order come from, and who may discount?", facts: [
      f("price_source", "known", "Signed quotation (machines); customer price list in Business Central (spares)"),
      f("discount_authority", "known", "Sales engineers to 12%; Commercial Director above"),
      f("discount_limits", "known", "12% — system blocks the order above this"),
    ], refs: ["T:seg-08", "T:seg-12", "Q:3"] },
    { id: "R2.3", state: "covered", q: "What stops an order being accepted, and who can release a blocked order?", facts: [
      f("blocking_rules", "known", "Credit limit breach and discount above 12%"),
      f("block_release_authority", "known", "Credit control (credit block); Commercial Director (discount block)"),
    ], refs: ["T:seg-18", "Q:7", "D:note-1"] },
    { id: "R2.4", state: "covered", q: "Can an order be changed after entry, and is that visible?", facts: [
      f("order_amendment_control", "known", "Line price may be changed; mandatory reason code; change logged by user"),
    ], refs: ["T:seg-09"] },
  ]},

  { id: "R3", name: "Credit management", items: [
    { id: "R3.1", plain: "Who can change a customer's credit limit — two sources give different answers", state: "partial", flags: ["contradiction"], q: "Who maintains credit limits and how are changes controlled?", facts: [
      f("limit_change_owner", "contradictory", "Credit control only (controller) vs. Commercial Director to EUR 50,000 (questionnaire)"),
      f("limit_change_approval", "contradictory", "CFO above EUR 250,000 — unclear whether any approval applies to the Commercial Director route"),
      f("limit_review_frequency", "unknown"),
    ], refs: ["T:seg-17", "Q:6", "D:note-1"] },
    { id: "R3.2", state: "covered", q: "Is credit blocking automated, and what evidence exists that releases are authorised?", facts: [
      f("credit_block_automated", "known", "Yes — system blocks the order on limit breach"),
      f("release_evidence", "known", "Business Central release log, maintained by credit control"),
    ], refs: ["T:seg-18", "D:note-1"] },
    { id: "R3.3", state: "covered", q: "How are overdue balances monitored and escalated?", facts: [
      f("ageing_review_owner", "known", "Financial controller with the CFO"),
      f("ageing_review_frequency", "known", "Monthly"),
      f("escalation_evidence", "assumed", "No documented follow-up seen"),
    ], refs: ["T:seg-30"] },
  ]},

  { id: "R4", name: "Delivery and performance of the obligation", items: [
    { id: "R4.1", mandatory: true, state: "covered", q: "What does the company have to do before it has earned the revenue?", facts: [
      f("performance_obligation", "known", "Machines: installation and signed acceptance protocol. Service: passage of time"),
      f("delivery_mode", "known", "Third-party logistics despatch (Van Dijk Logistics) plus on-site installation"),
    ], refs: ["T:seg-25", "T:seg-19", "T:seg-23"] },
    { id: "R4.2", state: "covered", q: "What proves that delivery or performance happened?", facts: [
      f("proof_of_delivery", "known", "Daily despatch confirmation file from Van Dijk Logistics; signed acceptance protocol for machines"),
      f("pod_retention", "assumed", "Retention location for acceptance protocols not established"),
    ], refs: ["T:seg-19", "T:seg-25"] },
    { id: "R4.3", state: "covered", q: "How is a delivery connected to an invoice, and how would an unbilled delivery be found?", facts: [
      f("delivery_invoice_link", "known", "Invoice generated overnight from the posted shipment"),
      f("unbilled_detection", "known", "Delivered-not-invoiced report exists in Business Central but is not run"),
    ], refs: ["T:seg-13", "T:seg-22"] },
    { id: "R4.4", state: "covered", q: "For over-time revenue, how is progress measured and who reviews the estimate?", facts: [
      f("progress_measure", "known", "Straight-line over the contract term — no estimate of progress required"),
      f("estimate_reviewer", "known", "Not applicable to a time-based measure"),
    ], refs: ["T:seg-23"] },
  ]},

  { id: "R5", name: "Invoicing", items: [
    { id: "R5.1", state: "covered", q: "How are invoices generated and how often?", facts: [
      f("invoice_generation", "known", "Automated overnight batch from posted shipments"),
      f("invoice_frequency", "known", "Nightly; service contracts billed quarterly in advance"),
    ], refs: ["T:seg-13", "T:seg-23", "D:doc-py-3"] },
    { id: "R5.2", state: "covered", q: "What ensures every invoice is recorded once and only once?", facts: [
      f("sequence_control", "known", "Business Central number series, no gaps permitted"),
      f("duplicate_prevention", "known", "One invoice per posted shipment"),
    ], refs: ["T:seg-13", "D:doc-py-3"] },
    { id: "R5.3", plain: "Who reviews the price override report, and what happens when an exception is found", mandatory: true, state: "partial", q: "How is the invoice amount derived, and what prevents it from being wrong?", facts: [
      f("price_source", "known", "Order price, derived from quotation or price list"),
      f("quantity_source", "known", "Posted shipment quantity"),
      f("automated_or_manual", "known", "Automated"),
      f("who_can_override_price", "known", "Sales staff, on the order line"),
      f("what_happens_on_override", "known", "Mandatory reason code; user and change logged"),
      f("override_report_reviewer", "unknown"),
      f("exception_handling", "unknown"),
    ], refs: ["T:seg-09", "T:seg-11", "T:seg-13"] },
    { id: "R5.4", state: "covered", q: "Can invoices be raised outside the normal flow?", facts: [
      f("manual_invoice_possible", "known", "Yes — settlements and project milestones"),
      f("manual_invoice_approver", "known", "Financial controller"),
    ], refs: ["T:seg-14"] },
    { id: "R5.5", plain: "How VAT is determined on an invoice, including on export sales", state: "open", q: "How is VAT or sales tax determined on an invoice?", facts: [
      f("vat_determination", "unknown"),
      f("export_evidence", "unknown"),
    ], refs: [] },
  ]},

  { id: "R6", name: "Revenue recognition", items: [
    { id: "R6.1", mandatory: true, state: "covered", q: "When is revenue recognised, and against which performance obligation?", facts: [
      f("recognition_trigger_products", "known", "Installation and signed customer acceptance protocol"),
      f("recognition_trigger_services", "known", "Straight-line over the contract term"),
      f("policy_documented", "known", "Group accounting manual, IFRS 15"),
    ], refs: ["T:seg-25", "T:seg-23"] },
    { id: "R6.2", state: "covered", q: "What triggers the posting to the general ledger, and is the interface reconciled?", facts: [
      f("gl_posting_trigger", "known", "Invoice posting in Business Central; nightly ServiceTrack interface"),
      f("interface_reconciliation", "known", "Service revenue account reconciled monthly by the financial controller"),
      f("interface_failure_alert", "known", "IT alerted on interface failure"),
    ], refs: ["T:seg-24"] },
    { id: "R6.3", state: "covered", q: "How is deferred or accrued revenue handled?", facts: [
      f("deferral_mechanism", "known", "ServiceTrack posts the deferral schedule to Business Central monthly"),
      f("deferral_review", "unknown"),
    ], refs: ["T:seg-23", "T:seg-24"] },
    { id: "R6.4", state: "covered", q: "Is there variable consideration, and is the company principal or agent?", facts: [
      f("variable_consideration", "known", "Volume rebates with three OEM customers"),
      f("principal_agent", "known", "Principal in all streams; no agency arrangements"),
    ], refs: ["T:seg-27", "Q:12"] },
    { id: "R6.5", mandatory: true, state: "covered", q: "Can revenue recognition be overridden manually, and by whom?", facts: [
      f("manual_recognition_override", "known", "Manual journals to revenue accounts by the financial controller or CFO"),
      f("override_approval", "known", "Reciprocal — controller and CFO approve each other's entries"),
    ], refs: ["T:seg-35"] },
  ]},

  { id: "R7", name: "Credit notes, returns and rebates", items: [
    { id: "R7.1", mandatory: true, state: "covered", q: "Who can raise a credit note, with what approval, and is it linked to the original invoice?", facts: [
      f("credit_note_raiser", "known", "Sales administration"),
      f("credit_note_approver", "known", "Sales manager"),
      f("invoice_link_required", "known", "Yes — must reference the original invoice"),
      f("value_threshold", "unknown"),
    ], refs: ["T:seg-26", "Q:10", "D:doc-py-5"] },
    { id: "R7.2", state: "na", q: "How are returns processed and provided for?",
      naReason: "Machines are not returnable under the standard terms and no machine return has occurred in the period. Spare-part returns are permitted within thirty days but are immaterial and infrequent (confirmed by the Commercial Director). No return provision is recognised.",
      facts: [], refs: ["Q:11"] },
    { id: "R7.3", state: "covered", q: "What rebates or bonuses exist, and how are they accrued?", facts: [
      f("rebate_arrangements", "known", "Volume rebates with three OEM customers"),
      f("accrual_preparer", "known", "Financial controller, from contract terms and year-to-date volume"),
      f("accrual_reviewer", "known", "None — spreadsheet prepared and released by one person"),
    ], refs: ["T:seg-27", "T:seg-29", "Q:4"] },
  ]},

  { id: "R8", name: "Cash receipt and accounts receivable", items: [
    { id: "R8.1", state: "covered", q: "How is cash applied against receivables, and what happens to unapplied cash?", facts: [
      f("cash_matching", "known", "Daily automatic matching on the payment reference"),
      f("unapplied_handling", "known", "Suspense list cleared by credit control"),
    ], refs: ["T:seg-30"] },
    { id: "R8.2", state: "covered", q: "Who can write off a receivable and within what limits?", facts: [
      f("write_off_approver", "known", "CFO above EUR 10,000"),
      f("write_off_below_threshold", "unknown"),
    ], refs: ["T:seg-31"] },
    { id: "R8.3", state: "covered", q: "How is the ageing reviewed and the expected credit loss determined?", facts: [
      f("ageing_review", "known", "Monthly, financial controller with the CFO"),
      f("ecl_basis", "unknown"),
    ], refs: ["T:seg-30"] },
  ]},

  { id: "R9", name: "Cut-off", items: [
    { id: "R9.1", mandatory: true, state: "covered", q: "What procedures ensure revenue falls in the right period?", facts: [
      f("cutoff_procedure", "known", "Financial controller compares shipment and invoice dates either side of month end"),
      f("cutoff_documented", "known", "No — the review is undocumented and performed by one person"),
    ], refs: ["T:seg-32", "T:seg-34", "D:note-2"] },
    { id: "R9.2", state: "covered", q: "What is the closing calendar and who controls late entries?", facts: [
      f("close_calendar", "known", "Ledger closes on working day four"),
      f("late_entry_control", "known", "Only the financial controller may post after close"),
    ], refs: ["T:seg-32"] },
    { id: "R9.3", plain: "How goods in transit and consignment stock are treated at the reporting date", state: "open", q: "How are undelivered orders and goods in transit treated at period end?", facts: [
      f("goods_in_transit_treatment", "unknown"),
      f("consignment_treatment", "unknown"),
      f("open_order_treatment", "unknown"),
    ], refs: [] },
  ]},

  { id: "R10", name: "IT environment and interfaces", items: [
    { id: "R10.1", state: "covered", q: "Which systems carry the revenue process and how are they hosted?", facts: [
      f("systems", "known", "Dynamics 365 Business Central (cloud); ServiceTrack; Van Dijk WMS"),
      f("hosting", "known", "Microsoft-hosted SaaS"),
    ], refs: ["T:seg-03", "T:seg-23"] },
    { id: "R10.2", state: "covered", q: "How does data move between order, delivery, invoice and the ledger?", facts: [
      f("interfaces", "known", "Van Dijk despatch file (daily); ServiceTrack to Business Central (nightly)"),
      f("interface_monitoring", "known", "Failure alert to IT; no completeness check on a partially loaded file"),
    ], refs: ["T:seg-19", "T:seg-21", "T:seg-24"] },
    { id: "R10.3", plain: "Which controls are configured in the system, and who can change that configuration", state: "open", q: "Which controls are automated, and who can change the configuration?", facts: [
      f("automated_control_inventory", "unknown"),
      f("config_change_authority", "unknown"),
      f("config_change_evidence", "unknown"),
    ], refs: [] },
    { id: "R10.4", state: "covered", q: "Who has access to change prices and customer master data?", facts: [
      f("price_list_access", "known", "14 users hold Price List – Modify"),
      f("master_data_access", "known", "9 users hold Customer Card – Modify, including two IT service accounts"),
      f("access_review", "known", "None — no periodic review of who holds this access"),
    ], refs: ["T:seg-38", "D:doc-al-1", "Q:8"] },
    { id: "R10.5", state: "covered", q: "Which parts of the process are performed by a service organisation?", facts: [
      f("service_organisation", "known", "Van Dijk Logistics — warehousing and despatch, since March 2026"),
      f("assurance_report", "known", "ISAE 3402 Type II available for FY2025 only"),
      f("cuec_identified", "known", "User entity must reconcile the despatch confirmation file to its own records"),
    ], refs: ["T:seg-19", "D:doc-so-4", "D:doc-so-11"] },
  ]},

  { id: "R11", name: "Manual journals and management override", items: [
    { id: "R11.1", mandatory: true, state: "covered", q: "Who can post a manual journal to a revenue account, and what approval is required?", facts: [
      f("journal_posters", "known", "Financial controller and CFO"),
      f("journal_approval", "known", "Reciprocal — each approves the other's entries"),
    ], refs: ["T:seg-35"] },
    { id: "R11.2", mandatory: true, state: "covered", q: "What standing or top-side entries touch revenue, especially at period end?", facts: [
      f("standing_entries", "known", "Monthly deferral release, generated automatically from the ServiceTrack schedule"),
      f("top_side_entries", "known", "None reported beyond the rebate accrual"),
    ], refs: ["T:seg-23", "T:seg-27"] },
    { id: "R11.3", mandatory: true, state: "covered", q: "What incentives or pressures relate to reported revenue?", facts: [
      f("sales_incentives", "known", "Commission on invoiced revenue for sales engineers"),
      f("management_incentives", "known", "Turnover component in the Commercial Director's bonus"),
      f("external_pressure", "known", "EBITDA covenant with the bank, tested half-yearly"),
    ], refs: ["T:seg-36", "Q:9"] },
  ]},

  { id: "R12", name: "Monitoring and KPIs", items: [
    { id: "R12.1", state: "covered", q: "How does management review reported revenue, and how precisely?", facts: [
      f("review_owner", "known", "Financial controller with the CFO"),
      f("review_frequency", "known", "Monthly"),
      f("review_precision", "known", "Variances above approximately EUR 250,000 investigated"),
    ], refs: ["T:seg-37"] },
    { id: "R12.2", state: "covered", q: "Is budget-versus-actual or margin analysis performed, and is follow-up evidenced?", facts: [
      f("analysis_performed", "known", "Revenue and gross margin by stream against budget"),
      f("follow_up_evidence", "assumed", "No documented record of investigation or conclusion seen"),
    ], refs: ["T:seg-37"] },
    { id: "R12.3", plain: "How the completeness and accuracy of the revenue report used by management is established", state: "partial", q: "Where do the reported numbers come from, and how is that information's completeness and accuracy established?", facts: [
      f("report_source", "known", "Business Central revenue and margin reports"),
      f("ipe_completeness_accuracy", "unknown"),
      f("report_change_control", "unknown"),
    ], refs: ["T:seg-37"] },
  ]},
];

/* --- Narrative -------------------------------------------------------------
   Inline provenance syntax used in `text`:
     [[T:seg-13|D:doc-py-3]]   one or more evidence ids -> a source chip
     [[none]]                  no source could be validated -> blocks approval
     [[conflict:T:seg-17|Q:6]] contradictory sources -> blocks approval
   -------------------------------------------------------------------------- */

export const narrative = [
  { id: "N1", n: "1", heading: "Overview", sub: "R1", blocks: [
    { id: "N1.1", text: "Vandersteen Industrial Systems B.V. designs, manufactures and installs conveyor and material-handling systems for the food processing industry, and provides maintenance services on the installed base. Revenue comprises two streams: machines and spare parts of approximately EUR 41.2 million, and service and maintenance contracts of approximately EUR 7.4 million. [[T:seg-02|Q:1]]" },
    { id: "N1.2", text: "The entity reports under EU-IFRS. Machine revenue is recognised at a point in time on customer acceptance; service revenue is recognised over time on a straight-line basis across the contract term. [[T:seg-25|T:seg-23]]" },
    { id: "N1.3", text: "The most significant change in the process during the period is the outsourcing of warehousing and despatch to Van Dijk Logistics in March 2026. In the prior year these activities were performed in-house at the Eindhoven site. [[T:seg-19|D:doc-py-7]]" },
  ]},

  { id: "N2", n: "2", heading: "Systems involved", sub: "R10", blocks: [
    { id: "N2.1", text: "Microsoft Dynamics 365 Business Central is the system of record for quotations, sales orders, shipments, invoices and the general ledger. ServiceTrack holds service contracts and field service records and generates the deferred revenue schedule. Van Dijk Logistics operates its own warehouse management system. [[T:seg-03|T:seg-23]]" },
    { id: "N2.2", text: "Two interfaces carry revenue data. Van Dijk Logistics transmits a despatch confirmation file each evening which posts shipments in Business Central. ServiceTrack posts the service billing and deferral schedule into Business Central nightly. IT is alerted if either interface fails to load. [[T:seg-19|T:seg-24]]" },
  ]},

  { id: "N3", n: "3", heading: "Roles and responsibilities", sub: "R1", blocks: [
    { id: "N3.1", text: "Sales engineers prepare quotations and enter machine orders. The Commercial Director approves quotations above EUR 100,000 and releases orders blocked for discounts above twelve per cent. [[Q:2|Q:3|T:seg-12]]" },
    { id: "N3.2", text: "Sales administration creates and maintains customer master data and the customer price lists, converts signed quotations into sales orders, and raises credit notes. [[T:seg-05|Q:8|T:seg-26]]" },
    { id: "N3.3", text: "Credit control sets credit limits and releases orders blocked for credit. The financial controller performs the month-end reconciliations, the cut-off review and the rebate accrual, and approves manual invoices. The CFO approves write-offs above EUR 10,000. [[T:seg-15|T:seg-18|T:seg-31]]" },
  ]},

  { id: "N4", n: "4", heading: "Order initiation and capture", sub: "R2", blocks: [
    { id: "N4.1", text: "Machine sales begin with a quotation prepared in the Business Central configurator by a sales engineer. The customer signs the quotation and sales administration converts it into a sales order. Spare part orders arrive by e-mail to the sales desk and through the webshop. Service work is initiated in ServiceTrack. [[T:seg-03]]" },
    { id: "N4.2", text: "There is no reconciliation between the sales mailbox and the orders recorded in Business Central. The company would become aware of an unrecorded spare part order when the customer followed up on the delivery. [[T:seg-04]]" },
  ]},

  { id: "N5", n: "5", heading: "Pricing and discounts", sub: "R2", blocks: [
    { id: "N5.1", text: "The price on a machine order is taken from the signed quotation. Spare part prices are derived by the system from the customer price list, of which each trade customer has an agreed version, with a standard list applied to all other customers. [[T:seg-08]]" },
    { id: "N5.2", text: "Sales staff are able to change the price on an order line. The system requires a reason code to be entered and records the user who made the change. A price override report is available in Business Central. [[T:seg-09]]" },
    { id: "N5.3", missing: true, text: "We did not establish who reviews the price override report, how often it is reviewed, or what evidence exists that exceptions are followed up. The financial controller stated that he did not believe the report was run on a routine basis. A question has been issued to the client. [[T:seg-11]]" },
    { id: "N5.4", text: "Discounts above twelve per cent block the sales order in the system until the Commercial Director releases it. This block has been configured since the Business Central implementation. [[T:seg-12|Q:3]]" },
  ]},

  { id: "N6", n: "6", heading: "Credit management", sub: "R3", blocks: [
    { id: "N6.1", text: "Credit limits are assessed at onboarding on the basis of a Graydon credit report and, for existing customers, the payment history on the account. [[T:seg-15]]" },
    { id: "N6.2", conflict: true,
      options: [
        { choice: "controller", label: "Credit control is correct",
          detail: "Two corroborating sources against one. The Commercial Director's answer is recorded as inconsistent and followed up.",
          text: "Credit limits are set and changed only by credit control, with the agreement of the CFO above EUR 250,000. [[T:seg-17|D:note-1]]" },
        { choice: "both", label: "Both are true — record the second route",
          detail: "The Commercial Director has an override the financial controller was unaware of. This weakens control C-02 and is itself a finding.",
          text: "Credit limits are set by credit control, with CFO agreement above EUR 250,000. The Commercial Director is additionally able to raise a limit by up to EUR 50,000 where an order is blocked, which the financial controller was not aware of. [[T:seg-17|Q:6]]" },
        { choice: "unresolved", label: "Leave it open and document the difference",
          detail: "Records the contradiction as an audit finding. The open item stays live and sign-off stays blocked.",
          text: "The authority to change a customer credit limit could not be established. Two sources give different answers and the difference has been raised with the entity. [[conflict:T:seg-17|Q:6]]" },
      ], text: "Authority to change a customer credit limit could not be established. The financial controller stated that only credit control may change a limit, with CFO agreement above EUR 250,000, and credit control confirmed that position. The Commercial Director stated in the questionnaire that he is able to raise a limit by up to EUR 50,000 himself where an order is blocked and he knows the customer. [[conflict:T:seg-17|Q:6|D:note-1]]" },
    { id: "N6.3", text: "An order that breaches the customer's credit limit is blocked by the system and can be released only by credit control. Releases are recorded in a log within Business Central. [[T:seg-18|D:note-1]]" },
  ]},

  { id: "N7", n: "7", heading: "Delivery and performance", sub: "R4", blocks: [
    { id: "N7.1", text: "Since March 2026 warehousing, picking, packing and despatch have been performed by Van Dijk Logistics at its Tilburg distribution centre. A despatch confirmation file is transmitted each evening and posts the corresponding shipments in Business Central. [[T:seg-19|D:doc-so-4]]" },
    { id: "N7.2", text: "Machine sales additionally require installation at the customer site and signature of an acceptance protocol by the customer. For a single conveyor this typically occurs in the same week as delivery; for a complete line it may occur up to six weeks after delivery. [[T:seg-25]]" },
    { id: "N7.3", text: "If the despatch file fails to load an error is raised and IT investigates. The financial controller stated that a file which loads successfully but contains fewer records than were despatched would not be detected. The ISAE 3402 report for Van Dijk Logistics identifies reconciliation of the despatch confirmation to the user entity's own records as a complementary user entity control. [[T:seg-21|D:doc-so-11]]" },
  ]},

  { id: "N8", n: "8", heading: "Invoicing", sub: "R5", blocks: [
    { id: "N8.1", text: "Invoices are generated automatically by Business Central in an overnight batch from posted shipments. The invoiced quantity is taken from the shipment record and the price from the sales order. No manual re-entry occurs in the standard flow. [[T:seg-13|D:doc-py-3]]" },
    { id: "N8.2", text: "Invoice numbering follows the Business Central number series and one invoice is generated per posted shipment. [[T:seg-13|D:doc-py-3]]" },
    { id: "N8.3", text: "Invoices may also be raised manually by finance, for settlements and for milestone billing on large projects. A manual invoice requires the approval of the financial controller before it is issued. [[T:seg-14]]" },
    { id: "N8.4", text: "Service contracts are invoiced quarterly in advance from ServiceTrack. [[T:seg-23]]" },
  ]},

  { id: "N9", n: "9", heading: "Revenue recognition", sub: "R6", blocks: [
    { id: "N9.1", text: "Machine revenue is recognised when the equipment has been installed and the customer has signed the acceptance protocol. Service revenue is recognised on a straight-line basis over the term of the maintenance contract. [[T:seg-25|T:seg-23|D:doc-py-3]]" },
    { id: "N9.2", text: "Service contracts are billed quarterly in advance. ServiceTrack maintains the deferral schedule and posts the monthly release of deferred revenue into Business Central. The financial controller reconciles the service revenue account at month end. [[T:seg-23|T:seg-24]]" },
    { id: "N9.3", text: "Volume rebate arrangements are in place with three OEM customers. The rebate accrual is calculated by the financial controller at month end from the contract terms and the year-to-date volume. The entity acts as principal in all revenue streams and there are no agency or bill-and-hold arrangements. [[T:seg-27|Q:12]]" },
  ]},

  { id: "N10", n: "10", heading: "Credit notes, returns and rebates", sub: "R7", blocks: [
    { id: "N10.1", text: "Credit notes are raised by sales administration and approved by the sales manager. A credit note must reference the original invoice. [[T:seg-26|D:doc-py-5]]" },
    { id: "N10.2", unsupported: true,
      suggestion: "Credit notes are raised by sales administration and approved by the sales manager. No value threshold requiring finance approval was identified. [[T:seg-26|D:doc-py-5]]",
      askedText: "We asked whether a value threshold applies above which finance must approve a credit note. No threshold has been established. [[T:seg-26]]", text: "Credit notes above EUR 5,000 additionally require the approval of the financial controller. [[none]]",
      why: "The model generalised from the pattern of value thresholds elsewhere in the process (CFO approval of write-offs above EUR 10,000, Commercial Director approval of quotations above EUR 100,000) and from the Commercial Director's statement that he would \"expect finance to look at\" larger credit notes. No source states a EUR 5,000 threshold." },
    { id: "N10.3", text: "Machines are not returnable under the standard sales conditions. Spare parts may be returned within thirty days, but returns are infrequent and immaterial, and no return provision is recognised. [[Q:11]]" },
    { id: "N10.4", missing: true, text: "We did not obtain evidence of any review of the volume rebate accrual. The financial controller prepares the calculation and releases it without independent review. [[T:seg-29]]" },
  ]},

  { id: "N11", n: "11", heading: "Cash receipt and receivables", sub: "R8", blocks: [
    { id: "N11.1", text: "Bank statements are loaded daily and matched automatically to open invoices on the payment reference. Items that do not match are placed on a suspense list which credit control clears. [[T:seg-30]]" },
    { id: "N11.2", unsupported: true,
      suggestion: "Receipts that do not match automatically are placed on a suspense list which credit control clears. No ageing threshold or escalation route for unapplied cash was established. [[T:seg-30]]",
      askedText: "We asked how long unapplied cash may remain on the suspense list and who is informed. No answer has been obtained. [[T:seg-30]]", text: "Unapplied cash older than sixty days is escalated to the financial controller for investigation. [[none]]",
      why: "No source states an ageing threshold or an escalation route for unapplied cash. The transcript establishes only that credit control clears the suspense list." },
    { id: "N11.3", text: "The aged receivables listing is reviewed monthly by the financial controller together with the CFO. Write-offs above EUR 10,000 require CFO approval. [[T:seg-30|T:seg-31]]" },
  ]},

  { id: "N12", n: "12", heading: "Cut-off", sub: "R9", blocks: [
    { id: "N12.1", text: "At each month end the financial controller compares shipment dates and invoice dates for transactions falling either side of the reporting date. The ledger closes on working day four, after which only the financial controller is able to post. [[T:seg-32]]" },
    { id: "N12.2", missing: true, text: "The cut-off review is not documented and is performed by one individual without independent review. We did not obtain a written cut-off procedure or evidence that the review was performed for any specific period. [[T:seg-34|D:note-2]]" },
    { id: "N12.3", missing: true, text: "We did not establish how undelivered orders, goods in transit at the third-party logistics provider, or stock held on consignment at the German distributor are treated at the reporting date. Questions have been issued to the client. [[Q:4]]" },
  ]},

  { id: "N13", n: "13", heading: "Manual journals and management override", sub: "R11", blocks: [
    { id: "N13.1", text: "Manual journals to revenue accounts may be posted by the financial controller and by the CFO. Each approves the entries posted by the other. No individual outside these two roles is able to post to a revenue account. [[T:seg-35]]" },
    { id: "N13.2", text: "The only standing entry affecting revenue is the monthly release of deferred service revenue, which is generated automatically from the ServiceTrack schedule. [[T:seg-23|T:seg-27]]" },
    { id: "N13.3", text: "Sales engineers are remunerated in part by commission on invoiced revenue and the Commercial Director's bonus contains a turnover component. The entity has an EBITDA covenant with its bank which is tested half-yearly. [[T:seg-36|Q:9]]" },
  ]},

  { id: "N14", n: "14", heading: "Monitoring and IT dependencies", sub: "R12", blocks: [
    { id: "N14.1", text: "The financial controller reviews revenue and gross margin by stream against budget each month and discusses the result with the CFO. Variances of approximately EUR 250,000 or more are investigated. [[T:seg-37]]" },
    { id: "N14.2", unsupported: true,
      suggestion: "The reports used in this review are produced by Business Central. We did not establish how their completeness and accuracy is confirmed. [[T:seg-37]]",
      askedText: "We asked how the completeness and accuracy of the revenue and margin report is established. No answer has been obtained. [[T:seg-37]]", text: "The reports used in this review are produced by Business Central and their completeness and accuracy are confirmed against the general ledger before the review takes place. [[none]]",
      why: "No source addresses the completeness and accuracy of the information used in the management review. This is the ISA 500 information-produced-by-the-entity question, and it remains open." },
    { id: "N14.3", text: "Fourteen users hold the permission to modify price lists and nine hold the permission to modify customer master data, including two IT service accounts. There is no periodic review of who holds this access. [[T:seg-38|D:doc-al-1]]" },
  ]},
];

/* --- Risks ----------------------------------------------------------------- */

export const risks = [
  { id: "R-01", lib: "RSK-REV-021", sub: "R5",
    title: "Unauthorised price overrides on sales orders inflate or deflate recorded revenue",
    desc: "Sales staff are able to change the price on an order line. The change is logged and requires a reason code, but no one reviews the override report, so an unauthorised or erroneous price would not be detected by the entity.",
    assertions: ["accuracy", "occurrence"], factors: ["susceptibility_to_bias_or_fraud"],
    rating: "higher", significant: true, fraud: true,
    drivers: "Sales engineers are remunerated by commission on invoiced revenue, and the override report is not reviewed by anyone.",
    refs: ["T:seg-09", "T:seg-11", "T:seg-36"], controls: [], gaps: ["G-01"] },

  { id: "R-02", lib: "RSK-REV-043", sub: "R10",
    title: "The third-party logistics despatch file is incomplete and the shortfall is not detected",
    desc: "Shipments are posted in Business Central from a daily file transmitted by Van Dijk Logistics. A file that loads successfully but contains fewer records than were despatched would not be identified, so deliveries would go unrecorded and uninvoiced.",
    assertions: ["completeness", "occurrence"], factors: ["complexity", "change"],
    rating: "higher", significant: true, fraud: false,
    drivers: "Warehousing was outsourced in March 2026, the ISAE 3402 report identifies this reconciliation as a complementary user entity control, and no reconciliation is performed.",
    refs: ["T:seg-19", "T:seg-21", "D:doc-so-11"], controls: [], gaps: ["G-02"] },

  { id: "R-03", lib: "RSK-REV-007", sub: "R4",
    title: "Goods despatched are not invoiced and the related revenue is not recorded",
    desc: "A delivered-not-invoiced report is available in Business Central but is not run, so a shipment that failed to generate an invoice would remain unbilled and unrecorded until the customer or the ageing brought it to attention.",
    assertions: ["completeness"], factors: ["complexity"],
    rating: "moderate", significant: false, fraud: false,
    drivers: "The report exists and is not used; invoicing depends on a nightly batch that is not reconciled to shipments.",
    refs: ["T:seg-22", "T:seg-13"], controls: [], gaps: ["G-03"] },

  { id: "R-04", lib: "RSK-REV-006", sub: "R9",
    title: "Revenue is recorded in the wrong period around the reporting date",
    desc: "The cut-off review compares shipment and invoice dates either side of month end, but it is undocumented, performed by a single individual and not independently reviewed. Machine revenue additionally depends on the date of a signed acceptance protocol, which is outside the shipment data.",
    assertions: ["cutoff", "occurrence"], factors: ["susceptibility_to_bias_or_fraud", "complexity"],
    rating: "higher", significant: true, fraud: true,
    drivers: "Acceptance can lag delivery by up to six weeks; the review is undocumented; an EBITDA covenant is tested half-yearly.",
    refs: ["T:seg-32", "T:seg-34", "T:seg-25", "D:note-2"], controls: [], gaps: ["G-05"] },

  { id: "R-05", lib: "RSK-REV-030", sub: "R11",
    title: "Management overrides controls through manual journals to revenue accounts",
    desc: "Manual journals to revenue may be posted by the financial controller and the CFO, who approve each other's entries. No approval independent of the two individuals with posting rights exists.",
    assertions: ["occurrence", "accuracy", "cutoff"], factors: ["susceptibility_to_bias_or_fraud"],
    rating: "higher", significant: true, fraud: true,
    drivers: "Reciprocal approval between the only two people who can post; covenant and bonus pressure on reported revenue.",
    refs: ["T:seg-35", "T:seg-36"], controls: ["C-13"], gaps: ["G-04"] },

  { id: "R-06", lib: "RSK-REV-029", sub: "R7",
    title: "The volume rebate accrual is understated, overstating revenue",
    desc: "The rebate accrual for three OEM customers is calculated in a spreadsheet by the financial controller from contract terms and year-to-date volume, and is released without independent review or recalculation.",
    assertions: ["accuracy", "cutoff"], factors: ["subjectivity", "susceptibility_to_bias_or_fraud"],
    rating: "moderate", significant: false, fraud: false,
    drivers: "Single-preparer spreadsheet outside the ERP, no review, and a direct effect on reported revenue.",
    refs: ["T:seg-27", "T:seg-29"], controls: [], gaps: [] },

  { id: "R-07", lib: "RSK-REV-024", sub: "R3", blocked: true,
    title: "Credit limits are raised outside credit control, and sales are made to customers who cannot pay",
    desc: "The authority to change a credit limit is in dispute between the sources obtained. If the Commercial Director is able to raise a limit unilaterally, the automated credit block ceases to be an effective preventive control.",
    assertions: ["accuracy_valuation_allocation", "occurrence"], factors: ["susceptibility_to_bias_or_fraud"],
    rating: "moderate", significant: false, fraud: false,
    drivers: "Contradictory evidence on limit-change authority; the Commercial Director's bonus contains a turnover component.",
    refs: ["T:seg-17", "Q:6", "D:note-1"], controls: ["C-02"], gaps: [] },

  { id: "R-08", lib: "RSK-REV-042", sub: "R10",
    title: "Excessive access to pricing and customer master data allows changes without detection",
    desc: "Fourteen users can modify price lists and nine can modify customer master data, including two IT service accounts. There is no periodic review of these access rights and no review of master data changes.",
    assertions: ["accuracy", "occurrence"], factors: ["complexity"],
    rating: "moderate", significant: false, fraud: false,
    drivers: "Broad standing access combined with the absence of any detective control over price changes.",
    refs: ["T:seg-38", "D:doc-al-1"], controls: [], gaps: ["G-01"] },

  { id: "R-09", lib: "RSK-REV-008", sub: "R2",
    title: "Spare part orders received by e-mail are not captured and the sale is never recorded",
    desc: "Spare part orders arriving in the sales mailbox are keyed manually into Business Central. No reconciliation exists between the mailbox and recorded orders.",
    assertions: ["completeness"], factors: ["complexity"],
    rating: "moderate", significant: false, fraud: false,
    drivers: "Manual keying from an unreconciled channel; detection depends on the customer following up.",
    refs: ["T:seg-04"], controls: [], gaps: [] },

  { id: "R-10", lib: "RSK-REV-031", sub: "R1",
    title: "Consignment stock at the German distributor is recognised as an ordinary sale",
    desc: "One distributor holds stock on consignment at its own site. If revenue is recognised on despatch to the distributor rather than on sale to the end customer, revenue is recognised before the performance obligation is satisfied.",
    assertions: ["occurrence", "cutoff"], factors: ["complexity", "change"],
    rating: "moderate", significant: false, fraud: false,
    drivers: "The arrangement was disclosed only in the questionnaire and the period-end treatment has not been established.",
    refs: ["Q:4"], controls: [], gaps: [], openItem: "OI-03" },

  { id: "R-11", lib: null, sub: "R6",
    newJustification: "No library entry addresses the accuracy of a deferral schedule maintained in a satellite system. RSK-REV-041 covers interface completeness between systems, not whether the schedule itself reflects the contract terms. Proposed for addition to the firm library.",
    title: "Deferral schedules maintained in ServiceTrack do not reflect the contract terms, misstating the release of deferred revenue",
    desc: "Service revenue is deferred and released on a schedule generated by ServiceTrack. The schedule's agreement to the underlying contract term and value is not independently checked; only the resulting account balance is reconciled.",
    assertions: ["accuracy", "cutoff"], factors: ["complexity", "change"],
    rating: "moderate", significant: false, fraud: false,
    drivers: "Service revenue has grown since the 2024 acquisition and the schedule originates outside the ERP.",
    refs: ["T:seg-23", "T:seg-24"], controls: ["C-12"], gaps: [] },
];

/* --- Controls -------------------------------------------------------------- */

export const controls = [
  { id: "C-01", lib: "CTL-REV-008", sub: "R2",
    title: "Discounts above twelve per cent block the order until the Commercial Director releases it",
    desc: "Business Central blocks a sales order where the line discount exceeds twelve per cent. The order cannot proceed until the Commercial Director releases it. The block has been configured since implementation.",
    type: "preventive", nature: "it_dependent_manual", frequency: "per_transaction",
    owner: "Commercial Director", ipe: null, ipeNote: null,
    evidenceOfOperation: "System block and release record in Business Central",
    itDependencies: ["Business Central discount threshold configuration"],
    risks: ["R-01"], assertions: ["accuracy"], refs: ["T:seg-12", "Q:3"],
    keyProposal: true, criteria: { addresses_rmm: "met", precision: "met", evidence_of_operation: "met", owner_competence_authority: "met", it_dependencies_identified: "met", not_redundant: "met" },
    rationale: "Addresses the accuracy risk on order pricing at the point of entry, is precise (a configured threshold, not judgement), and produces a system record of each release." },

  { id: "C-02", lib: "CTL-REV-009", sub: "R3",
    title: "Orders exceeding the credit limit are blocked and released only by credit control",
    desc: "Business Central blocks an order where the customer's exposure would exceed the approved credit limit. Credit control releases the block and the release is recorded in a log.",
    type: "preventive", nature: "it_dependent_manual", frequency: "per_transaction",
    owner: "Credit control", ipe: "Credit exposure report", ipeNote: null,
    evidenceOfOperation: "Business Central block release log",
    itDependencies: ["Credit limit master data", "Business Central credit block configuration"],
    risks: ["R-07"], assertions: ["accuracy_valuation_allocation", "occurrence"], refs: ["T:seg-18", "D:note-1"],
    keyProposal: true, criteria: { addresses_rmm: "met", precision: "met", evidence_of_operation: "met", owner_competence_authority: "unknown", it_dependencies_identified: "met", not_redundant: "met" },
    rationale: "Addresses the credit risk at the point of order acceptance and leaves a release log. Owner authority cannot be confirmed while the authority to change the underlying limit is in dispute.",
    blocked: "Depends on open item OI-01 — the authority to change a credit limit is contradictory across sources." },

  { id: "C-03", lib: "CTL-REV-017", sub: "R5",
    title: "Invoices are generated automatically from the posted shipment without re-keying",
    desc: "An overnight batch in Business Central raises an invoice for each posted shipment, taking quantity from the shipment record and price from the sales order. No manual intervention occurs in the standard flow.",
    type: "preventive", nature: "automated", frequency: "per_transaction",
    owner: "Business Central (configured)", ipe: null, ipeNote: null,
    evidenceOfOperation: "Batch job log; invoice-to-shipment linkage in the system",
    itDependencies: ["Overnight invoicing batch", "Order-to-shipment data integrity"],
    risks: ["R-03"], assertions: ["accuracy", "occurrence"], refs: ["T:seg-13", "D:doc-py-3"],
    keyProposal: true, criteria: { addresses_rmm: "met", precision: "met", evidence_of_operation: "met", owner_competence_authority: "met", it_dependencies_identified: "met", not_redundant: "met" },
    rationale: "Automated, per transaction, and removes the manual transcription risk between shipment and invoice. Reliance requires effective IT general controls over the Business Central environment." },

  { id: "C-04", lib: "CTL-REV-020", sub: "R5",
    title: "Manual invoices require the approval of the financial controller before issue",
    desc: "Invoices raised outside the automated flow — settlements and project milestone billing — are approved by the financial controller before they are issued.",
    type: "preventive", nature: "manual", frequency: "event_driven",
    owner: "Financial controller", ipe: null, ipeNote: null,
    evidenceOfOperation: null,
    itDependencies: [],
    risks: ["R-01"], assertions: ["occurrence", "accuracy"], refs: ["T:seg-14"],
    keyProposal: true, criteria: { addresses_rmm: "met", precision: "met", evidence_of_operation: "unknown", owner_competence_authority: "met", it_dependencies_identified: "met", not_redundant: "met" },
    rationale: "Manual invoices bypass the automated derivation of price and quantity, so this is the only preventive control on that population. Evidence that the approval is recorded has not been established.",
    followUp: "Ask what record is retained of the controller's approval of a manual invoice." },

  { id: "C-05", lib: "CTL-REV-025", sub: "R7",
    title: "Credit notes are approved by the sales manager and must reference the original invoice",
    desc: "Sales administration raises the credit note; the sales manager approves it; the system requires a reference to the original invoice.",
    type: "preventive", nature: "it_dependent_manual", frequency: "event_driven",
    owner: "Sales manager", ipe: null, ipeNote: null,
    evidenceOfOperation: "Approval recorded in Business Central; invoice reference on the document",
    itDependencies: ["Mandatory invoice reference field"],
    risks: [], assertions: ["occurrence"], refs: ["T:seg-26", "D:doc-py-5"],
    keyProposal: false, criteria: { addresses_rmm: "met", precision: "not_met", evidence_of_operation: "met", owner_competence_authority: "not_met", it_dependencies_identified: "met", not_redundant: "met" },
    rationale: "Not proposed as key. The approver sits within the sales function, so the control does not address the risk of revenue reversal being used to conceal a sales-side misstatement, and there is no value threshold above which finance is involved." },

  { id: "C-06", lib: "CTL-REV-022", sub: "R6",
    title: "The service revenue account is reconciled to the billing sub-ledger monthly",
    desc: "The financial controller reconciles the service revenue account in Business Central to the ServiceTrack billing and deferral data at each month end.",
    type: "detective", nature: "it_dependent_manual", frequency: "monthly",
    owner: "Financial controller", ipe: "ServiceTrack billing extract", ipeNote: "Completeness and accuracy of the extract has not been established.",
    evidenceOfOperation: null,
    itDependencies: ["ServiceTrack to Business Central nightly interface"],
    risks: ["R-11"], assertions: ["completeness", "accuracy"], refs: ["T:seg-24"],
    keyProposal: true, criteria: { addresses_rmm: "met", precision: "unknown", evidence_of_operation: "unknown", owner_competence_authority: "met", it_dependencies_identified: "met", not_redundant: "met" },
    rationale: "The only control over the completeness of service revenue transferred between systems. Precision and evidence of operation are not established, so the criteria are not yet all met.",
    followUp: "Request the September reconciliation and establish how differences are investigated and cleared." },

  { id: "C-07", lib: "CTL-REV-012", sub: "R8",
    title: "The aged receivables listing is reviewed monthly by the financial controller and the CFO",
    desc: "The ageing is reviewed each month and overdue balances are discussed. Documented follow-up of individual balances was not observed.",
    type: "detective", nature: "it_dependent_manual", frequency: "monthly",
    owner: "Financial controller", ipe: "Business Central aged receivables report", ipeNote: "Completeness and accuracy not established.",
    evidenceOfOperation: null,
    itDependencies: ["Aged receivables report logic"],
    risks: [], assertions: ["accuracy_valuation_allocation"], refs: ["T:seg-30"],
    keyProposal: false, criteria: { addresses_rmm: "met", precision: "unknown", evidence_of_operation: "not_met", owner_competence_authority: "met", it_dependencies_identified: "unknown", not_redundant: "met" },
    rationale: "Not proposed as key. No evidence of operation was identified and the precision of the review is not established." },

  { id: "C-08", lib: "CTL-REV-028", sub: "R8",
    title: "Bank receipts are matched daily and unapplied cash is cleared by credit control",
    desc: "Bank statements load daily and match automatically to open invoices on the payment reference. Unmatched receipts go to a suspense list which credit control clears.",
    type: "detective", nature: "it_dependent_manual", frequency: "daily",
    owner: "Credit control", ipe: "Suspense list", ipeNote: null,
    evidenceOfOperation: "Cleared suspense list in Business Central",
    itDependencies: ["Automatic matching on payment reference"],
    risks: [], assertions: ["existence", "accuracy"], refs: ["T:seg-30"],
    keyProposal: false, criteria: { addresses_rmm: "met", precision: "unknown", evidence_of_operation: "met", owner_competence_authority: "met", it_dependencies_identified: "met", not_redundant: "met" },
    rationale: "Relevant to receivables rather than to a revenue assertion assessed as a risk of material misstatement. Not proposed as key for revenue." },

  { id: "C-09", lib: "CTL-REV-029", sub: "R8",
    title: "Receivable write-offs above EUR 10,000 are approved by the CFO",
    desc: "A write-off of a receivable balance above EUR 10,000 requires CFO approval.",
    type: "preventive", nature: "manual", frequency: "event_driven",
    owner: "CFO", ipe: null, ipeNote: null, evidenceOfOperation: null, itDependencies: [],
    risks: [], assertions: ["existence", "accuracy_valuation_allocation"], refs: ["T:seg-31"],
    keyProposal: false, criteria: { addresses_rmm: "met", precision: "met", evidence_of_operation: "unknown", owner_competence_authority: "met", it_dependencies_identified: "met", not_redundant: "met" },
    rationale: "Addresses receivables rather than revenue recognition. The treatment of write-offs below the threshold is not established." },

  { id: "C-10", lib: "CTL-REV-033", sub: "R12",
    title: "Management reviews revenue and gross margin against budget monthly",
    desc: "The financial controller reviews revenue and gross margin by stream against budget each month and discusses the result with the CFO. Variances of approximately EUR 250,000 or more are investigated.",
    type: "detective", nature: "it_dependent_manual", frequency: "monthly",
    owner: "Financial controller", ipe: "Business Central revenue and margin report",
    ipeNote: "The completeness and accuracy of the report used in the review has not been established (ISA 500).",
    evidenceOfOperation: null,
    itDependencies: ["Revenue and margin report definition"],
    risks: ["R-01", "R-03"], assertions: ["completeness", "accuracy", "occurrence"], refs: ["T:seg-37"],
    keyProposal: null, criteria: { addresses_rmm: "met", precision: "unknown", evidence_of_operation: "not_met", owner_competence_authority: "met", it_dependencies_identified: "unknown", not_redundant: "met" },
    rationale: "Cannot be proposed either way. A threshold of EUR 250,000 against performance materiality of EUR 415,000 may be sufficiently precise, but there is no evidence that the review was performed and the completeness and accuracy of the report has not been addressed.",
    followUp: "Two criteria are unmet or unknown. Establish what record exists of the monthly review and how the report is produced." },

  { id: "C-11", lib: "CTL-REV-005", sub: "R2",
    title: "Machine orders are created only from a customer-signed quotation",
    desc: "Sales administration converts a signed quotation into a sales order. The order carries the quotation reference and the price agreed on the quotation.",
    type: "preventive", nature: "manual", frequency: "per_transaction",
    owner: "Sales administration", ipe: null, ipeNote: null,
    evidenceOfOperation: "Signed quotation retained against the order",
    itDependencies: [],
    risks: ["R-09"], assertions: ["occurrence", "accuracy"], refs: ["T:seg-03", "T:seg-08"],
    keyProposal: true, criteria: { addresses_rmm: "met", precision: "met", evidence_of_operation: "met", owner_competence_authority: "met", it_dependencies_identified: "met", not_redundant: "met" },
    rationale: "Establishes that a machine sale is supported by a customer-agreed price and scope before the order enters the flow. Does not extend to spare part orders." },

  { id: "C-12", lib: "CTL-REV-021", sub: "R6",
    title: "The deferral schedule is generated by ServiceTrack from the contract configuration",
    desc: "ServiceTrack holds the service contract and generates the monthly deferred revenue release, which posts into Business Central automatically.",
    type: "preventive", nature: "automated", frequency: "monthly",
    owner: "ServiceTrack (configured)", ipe: null, ipeNote: null,
    evidenceOfOperation: "Posted deferral journal",
    itDependencies: ["ServiceTrack contract configuration", "Nightly interface"],
    risks: ["R-11"], assertions: ["accuracy", "cutoff"], refs: ["T:seg-23", "T:seg-24"],
    keyProposal: true, criteria: { addresses_rmm: "met", precision: "met", evidence_of_operation: "met", owner_competence_authority: "met", it_dependencies_identified: "met", not_redundant: "met" },
    rationale: "Automated derivation of the deferral removes manual judgement from the release of service revenue. Reliance depends on ITGC over ServiceTrack and on the accuracy of the contract set-up." },

  { id: "C-13", lib: "CTL-REV-024", sub: "R11",
    title: "Manual journals to revenue require a preparer and an approver",
    desc: "Every manual journal to a revenue account is prepared by one individual and approved by another. In practice the financial controller and the CFO prepare and approve each other's entries.",
    type: "preventive", nature: "manual", frequency: "event_driven",
    owner: "Financial controller / CFO", ipe: null, ipeNote: null,
    evidenceOfOperation: "Preparer and approver recorded on the journal in Business Central",
    itDependencies: [],
    risks: ["R-05"], assertions: ["occurrence", "accuracy", "cutoff"], refs: ["T:seg-35"],
    keyProposal: false, criteria: { addresses_rmm: "met", precision: "met", evidence_of_operation: "met", owner_competence_authority: "not_met", it_dependencies_identified: "met", not_redundant: "met" },
    rationale: "Not proposed as key. The approval is reciprocal between the only two individuals able to post to revenue, so it does not provide authority independent of the preparer. Recorded as a design deficiency.",
    designIssue: true },

  { id: "C-14", lib: "CTL-REV-004", sub: "R1",
    title: "Quotations above EUR 100,000 are approved by the Commercial Director before issue",
    desc: "A machine quotation with a value above EUR 100,000 is reviewed and approved by the Commercial Director before it is sent to the customer. Below that value the sales engineer issues it directly.",
    type: "preventive", nature: "manual", frequency: "event_driven",
    owner: "Commercial Director", ipe: null, ipeNote: null, evidenceOfOperation: null, itDependencies: [],
    risks: [], assertions: ["accuracy", "occurrence"], refs: ["Q:2"],
    keyProposal: false, criteria: { addresses_rmm: "unknown", precision: "met", evidence_of_operation: "unknown", owner_competence_authority: "met", it_dependencies_identified: "met", not_redundant: "unknown" },
    rationale: "Established from a single questionnaire answer and not corroborated in the walkthrough. Not proposed as key until the control is confirmed with the entity.",
    followUp: "Confirm the quotation approval threshold and the record retained, in the follow-up call." },
];

/* --- Control gaps ---------------------------------------------------------- */

export const gaps = [
  { id: "G-01", risk: "R-01", sub: "R5",
    desc: "No control operates over price overrides on sales orders. The system records the override and a report exists, but the report is not reviewed by anyone, so an unauthorised price change is neither prevented nor detected.",
    severity: "significant_deficiency_candidate",
    impact: "An incorrect or unauthorised price is invoiced and recorded without detection. Combined with commission on invoiced revenue, this is the entity's most direct exposure to the accuracy assertion.",
    remediation: "Assign monthly review of the price override report to a role outside sales, with documented follow-up of each exception; or configure the system to block manual price entry on order lines.",
    refs: ["T:seg-09", "T:seg-11"] },

  { id: "G-02", risk: "R-02", sub: "R10",
    desc: "The daily despatch confirmation file from Van Dijk Logistics is not reconciled to the entity's own order and shipment records. The service organisation's ISAE 3402 report identifies this reconciliation as a complementary user entity control that the user entity is expected to perform.",
    severity: "significant_deficiency_candidate",
    impact: "Deliveries made by the logistics provider may not be recorded or invoiced, understating revenue and receivables. The entity has no compensating detective control.",
    remediation: "Reconcile the record count and quantities in the daily despatch file to open orders and posted shipments, and investigate differences before the invoicing batch runs.",
    refs: ["T:seg-21", "D:doc-so-11"] },

  { id: "G-03", risk: "R-03", sub: "R4",
    desc: "The delivered-not-invoiced report available in Business Central is not run. There is no detective control over shipments that fail to generate an invoice.",
    severity: "deficiency",
    impact: "Unbilled deliveries remain undetected until the customer or the receivables ageing brings them to attention.",
    remediation: "Run and clear the delivered-not-invoiced report on a defined frequency, with the resolution of each item documented.",
    refs: ["T:seg-22"] },

  { id: "G-04", risk: "R-05", sub: "R11",
    desc: "Manual journals to revenue accounts are prepared and approved reciprocally by the financial controller and the CFO. No approval independent of the individuals with posting rights exists.",
    severity: "significant_deficiency_candidate",
    impact: "The entity has no effective control over management override of revenue recognition, which ISA 240 requires the auditor to treat as a risk in every engagement.",
    remediation: "Route approval of manual journals to revenue accounts to an individual without posting rights, or introduce a period-end review of all such entries by a party independent of both.",
    refs: ["T:seg-35"] },

  { id: "G-05", risk: "R-04", sub: "R9",
    desc: "There is no documented cut-off procedure. The month-end comparison of shipment and invoice dates is performed by one individual, is not evidenced, and does not address the acceptance protocol date on which machine revenue depends.",
    severity: "deficiency",
    impact: "Revenue may be recorded in the wrong period without detection, particularly where installation and acceptance lag delivery.",
    remediation: "Document the cut-off procedure, extend it to the acceptance protocol date for machine sales, and evidence its performance and review each period end.",
    refs: ["T:seg-34", "D:note-2"] },
];

/* --- Open items ------------------------------------------------------------ */

export const openItems = [
  { id: "OI-01", kind: "contradiction", coverage: "R3.1", priority: "high", state: "open",
    title: "Contradictory evidence on who may change a customer credit limit",
    detail: "The financial controller and credit control both stated that only credit control may change a limit, with CFO agreement above EUR 250,000. The Commercial Director stated in the questionnaire that he may raise a limit by up to EUR 50,000 himself.",
    origin: "deterministic_trigger", blocks: ["N6.2", "C-02", "R-07"],
    refs: ["T:seg-17", "Q:6", "D:note-1"], owner: "Sanne Bakker" },

  { id: "OI-02", kind: "question", coverage: "R5.3", priority: "mandatory", state: "sent",
    title: "Who reviews the price override report, and how often?",
    detail: "Coverage item R5.3 is a mandatory item and the fact `override_report_reviewer` is unknown. Without it the entity has no identified control over the accuracy of invoiced prices.",
    origin: "deterministic_trigger", trigger: "R5.3.T2", blocks: ["N5.3", "G-01"],
    refs: ["T:seg-11"], owner: "Sent to R. Timmermans · 20 Sep 2026" },

  { id: "OI-03", kind: "question", coverage: "R9.3", priority: "high", state: "sent",
    title: "How is consignment stock at the German distributor treated at period end?",
    detail: "The consignment arrangement was disclosed only in the questionnaire. Whether revenue is recognised on despatch to the distributor or on sale to the end customer determines whether revenue is recognised before the performance obligation is satisfied.",
    origin: "model_proposed", blocks: ["N12.3", "R-10"],
    refs: ["Q:4"], owner: "Sent to B. Kuipers · 20 Sep 2026" },

  { id: "OI-04", kind: "evidence", coverage: "R5.3", priority: "high", state: "open",
    title: "Price override report — configuration and a sample output",
    detail: "Needed to establish whether the report captures every override and what fields it presents, before any control over overrides could be relied upon.",
    origin: "model_proposed", blocks: ["G-01"], refs: ["T:seg-09"], owner: "P. Halsema — not yet sent" },

  { id: "OI-05", kind: "evidence", coverage: "R4.2", priority: "medium", state: "open",
    title: "Example of a signed customer acceptance protocol",
    detail: "Machine revenue is recognised on acceptance. We have not seen the document, where it is retained, or how its date reaches the accounting records.",
    origin: "deterministic_trigger", blocks: ["R-04"], refs: ["T:seg-25"], owner: "R. Timmermans — not yet sent" },

  { id: "OI-06", kind: "question", coverage: "R5.5", priority: "medium", state: "open",
    title: "How is VAT determined on an invoice, including on export sales?",
    detail: "Coverage item R5.5 is open. No source addresses VAT determination, the treatment of intra-community supplies, or the evidence retained for zero-rating.",
    origin: "deterministic_trigger", blocks: [], refs: [], owner: "Unassigned" },

  { id: "OI-07", kind: "question", coverage: "R10.3", priority: "medium", state: "open",
    title: "Which revenue controls are configured in the system, and who can change that configuration?",
    detail: "Coverage item R10.3 is open. Three automated or IT-dependent controls have been identified as candidates for reliance; none can be relied upon without understanding who can change the configuration.",
    origin: "deterministic_trigger", blocks: ["C-01", "C-03", "C-12"], refs: [], owner: "Tim Vos" },

  { id: "OI-08", kind: "evidence", coverage: "R10.5", priority: "high", state: "open",
    title: "Van Dijk Logistics — assurance coverage for the current period",
    detail: "The ISAE 3402 Type II report obtained covers the year to 31 December 2025. Van Dijk has performed the despatch process since March 2026, so the report does not cover any part of the period under audit. A bridge letter or a FY2026 report is required.",
    origin: "model_proposed", blocks: ["R-02"], refs: ["D:doc-so-4"], owner: "R. Timmermans — not yet sent" },

  { id: "OI-09", kind: "evidence", coverage: "R10.4", priority: "medium", state: "open",
    title: "ServiceTrack user access listing",
    detail: "The access listing obtained covers Business Central only. Service revenue and the deferral schedule originate in ServiceTrack, for which no access information has been obtained.",
    origin: "model_proposed", blocks: ["R-08"], refs: ["D:doc-al-1"], owner: "P. Halsema — not yet sent" },

  { id: "OI-10", kind: "question", coverage: "R12.3", priority: "high", state: "open",
    title: "How is the completeness and accuracy of the revenue and margin report established?",
    detail: "The monthly management review is a candidate key control, but the report it relies on is information produced by the entity and its completeness and accuracy has not been addressed (ISA 500.9).",
    origin: "deterministic_trigger", blocks: ["C-10", "N14.2"], refs: ["T:seg-37"], owner: "Unassigned" },
];

/* --- Generation, in two stages ----------------------------------------------
   Step 3 establishes and documents how the process works. Step 4 analyses what
   controls it and what is wrong with it. They are separate runs because they
   are separate pieces of audit work: the auditor reviews the understanding
   before anything is concluded from it.

   An implementation may reuse one model call across both — this split is the
   product model, not a deployment constraint.
   -------------------------------------------------------------------------- */

/* Step 3 — process understanding. */
export const pipeline = [
  { id: "U1", name: "Normalising sources", model: "claude-haiku-4-5",
    desc: "Segmenting the transcript, the questionnaire answers and the document chunks, and attaching a stable locator to each.",
    out: "6 sources · 38 transcript segments · 12 answers · 134 document chunks", ms: 900 },
  { id: "U2", name: "Extracting process facts", model: "claude-sonnet-5",
    desc: "Mapping what was said onto the must-know facts of the 45 coverage items in pack revenue v0.1.0. Every fact carries at least one evidence reference.",
    out: "FACTS_KNOWN facts extracted across 45 coverage items · FACTS_UNKNOWN not established", ms: 2400 },
  { id: "U3", name: "Evaluating methodology coverage", model: "deterministic",
    desc: "Code, not the model. Comparing the extracted facts against the pack's required areas and marking what is established, partial, unknown or contradictory.",
    out: "COV_COVERED of COV_APPLICABLE areas established · MANDATORY_OPEN required areas still open", ms: 700 },
  { id: "U4", name: "Structuring the process and its variants", model: "claude-opus-5",
    desc: "Separating the flows that are materially different processes, and ordering the steps of each. Machines, spare parts and service contracts share a spine and diverge.",
    out: "3 variants · 11 process steps · 2 divergence points · 1 convergence point", ms: 2800 },
  { id: "U5", name: "Generating the process narrative", model: "claude-opus-5",
    desc: "Drafting the process narrative in firm house style, sub-process by sub-process, with an evidence reference on every block.",
    out: "14 sections · 41 blocks", ms: 3400 },
  { id: "U6", name: "Assembling the process map", model: "deterministic",
    desc: "Code, not the model. Laying out the steps from their variant membership and successors — the map and the model cannot disagree.",
    out: "11 nodes across 2 lanes · every node traced to a source", ms: 600 },
  { id: "U7", name: "Identifying statements needing clarification", model: "claude-sonnet-5",
    desc: "Flagging where two sources disagree and where the pack requires a fact that nothing established, then generating the follow-up each one needs.",
    out: "1 contradiction · 3 required areas open · 4 follow-ups drafted", ms: 1600 },
  { id: "U8", name: "Validating source references", model: "deterministic",
    desc: "Code, not the model. Every quote must occur in the source it cites, and every generated statement must carry at least one evidence reference.",
    out: "38 of 41 narrative blocks grounded · 3 could not be validated → marked Needs support",
    warn: true, ms: 1100 },
  { id: "U9", name: "Assembling the process-understanding workpaper", model: "deterministic",
    desc: "Building the narrative, the map and the coverage assessment into one reviewable document. No model call, and nothing is concluded.",
    out: "Understanding workpaper assembled · nothing concluded", ms: 700 },
];

/* Step 4 — controls and findings. Runs against the *reviewed* understanding,
   which is why it is a second run and not nine more stages of the first. */
export const analysisPipeline = [
  { id: "A1", name: "Identifying controls", model: "claude-opus-5",
    desc: "Mapping the controls described in the reviewed understanding onto the 33-entry control library, and attaching each to the process step it sits on.",
    out: "CONTROL_COUNT controls identified · 11 from the library · 3 not in it", ms: 2900 },
  { id: "A2", name: "Identifying control gaps and process findings", model: "claude-opus-5",
    desc: "Looking for steps with nothing controlling them, and for things wrong with the process that are not control gaps.",
    out: "GAP_COUNT control gaps · 1 process observation", ms: 2400 },
  { id: "A3", name: "Identifying risk signals", model: "claude-opus-5",
    desc: "Mapping the facts onto the 30-entry revenue risk library at assertion level. Signals for the risk analysis phase — nothing here is an assessed risk of material misstatement.",
    out: "RISK_COUNT risk signals · 10 from the library · 1 outside it, with justification", ms: 2900 },
  { id: "A4", name: "Mapping controls to risk signals", model: "deterministic",
    desc: "Code, not the model. Pairing each identified control with the signals it addresses, and flagging every signal with nothing against it.",
    out: "RCM_ROWS pairs · GAP_COUNT signals with no control", ms: 600 },
  { id: "A5", name: "Evaluating the firm's key-control criteria", model: "claude-opus-5",
    desc: "Testing each control against the six key-control criteria. A criterion that cannot be established produces a follow-up question, not a lower-confidence conclusion.",
    out: "KEY_COUNT proposed as key · 2 could not be assessed", ms: 2400 },
  { id: "A6", name: "Validating source references", model: "deterministic",
    desc: "Code, not the model. Every proposed control, gap and signal must cite the part of the understanding it came from.",
    out: "All proposals traced to the reviewed understanding", ms: 800 },
  { id: "A7", name: "Assembling the matrix and the review queues", model: "deterministic",
    desc: "Building the risk and control matrix and the two recommendation queues. Every proposal is a proposal until you conclude it.",
    out: "RCM_ROWS matrix rows · CONTROL_COUNT controls and FINDING_COUNT findings to conclude", ms: 700 },
];
