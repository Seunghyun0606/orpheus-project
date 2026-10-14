# Version-pinned ending presentation — DEC-058

EndingPresentation schema 1 is separate from Scenario, CampaignDefinition and saved
ledger state. A CampaignPackage may pin `endingPresentation: {id, version}`; older
generic packages without prose remain unchanged. The new production route requires
the exact binding and all ten ending identities declared by its data manifest.

The authority declares ID/version, campaign and ending-definition ID/version,
Boolean known-discovery references to declared campaign narrative flags, one typed
prose entry per ending, conditional sections with explicit member IDs/reveal trees,
and shared closing blocks. Blocks are text paragraphs, speaker dialogue or labeled
authored-policy/future reports, never HTML/scripts/callbacks. Reject duplicate IDs,
unknown blocks/references/ending IDs, missing coverage and version/authority mismatch.

The engine's read-only projection takes a resolved package, canonical run and exact
attempt/head request. It reuses whole-record replay and final-completion/action
provenance from `resolveCampaignEnding`, not a cached caller winner or edited score.
Only a resolved outcome can return its prose; ambiguous/no-match outcomes return no
prose and diagnostic outcomes return no partial view. All reveal trees are checked
before returning gated text. Actual revealed final service signals/resources,
elapsed time and independent completion/recovery state accompany the narrative.

PROJECT_DISTRIBUTED gates the title recap. PROMETHEUS additionally requires one of
LIBERATION, WHISTLEBLOWER, SHUTDOWN, CUSTODIAN, NULL or REWRITE. The thematic final
question closes every resolved ending. These gates do not alter ending eligibility
or grant a discovery. Future report numbers are authored fiction, not behavior data.

UI querying is explicit, memoized against immutable current inputs, and invalidated
by changed run/attempt/head or a pending operation. Rendering has no storage/command/
ACK effect, does not create an ending receipt/flag, and re-evaluates pinned authority
after restoration. No latest-authority fallback, ledger migration or old package
attachment is introduced. Full integration, verification and acceptance remain pending.
