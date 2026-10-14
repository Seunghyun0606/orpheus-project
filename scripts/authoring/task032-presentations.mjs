// Offline authoring from approved drafts/proposal only. No I/O, runtime
// registration, resolver call, default samples or verification/acceptance.
export function authorTask032Presentations(draft, proposal) {
  // Historical approved drafts used an unquoted YAML NULL token for the named
  // character/ending. Resolve that known authoring spelling here only; runtime
  // schemas still reject null IDs/speakers and never coerce malformed input.
  const namedEnding = (id) => (id === null ? 'NULL' : id);
  const endings = proposal.proposal.prose.ending_ids.map(namedEnding);
  const contextualLabels = {
    months_later_pager: 'Months later / Pager',
    months_later_other_company_system: 'Months later / Another company',
    sound_cue_intent_not_audio_asset: 'Narrative sound cue',
    fictional_interface_label: 'Interface record',
    fictional_terminal_input: 'Terminal record',
  };
  const entries = draft.endings.map((entry, index) => {
    const prefix = 'ENDING_' + (index + 1);
    const blocks = entry.outcomes.map((text, i) => ({
      id: prefix + '_OUTCOME_' + i,
      kind: 'paragraph',
      text,
    }));
    for (const [i, closing] of entry.closing.entries()) {
      const speaker =
        Object.hasOwn(closing, 'speaker') && closing.speaker === null ? 'NULL' : closing.speaker;
      if (contextualLabels[closing.kind])
        blocks.push({
          id: prefix + '_CONTEXT_' + i,
          kind: 'paragraph',
          text: contextualLabels[closing.kind],
        });
      const base = { id: prefix + '_CLOSING_' + i, text: closing.text };
      blocks.push(
        speaker
          ? { ...base, kind: 'dialogue', speaker }
          : closing.kind === 'future_institutional_report_not_player_metric'
            ? { ...base, kind: 'policy_report', provenance: 'authored_future' }
            : ['fictional_policy_record', 'fictional_service_record'].includes(closing.kind)
              ? { ...base, kind: 'policy_report', provenance: 'authored_policy' }
              : { ...base, kind: 'paragraph' },
      );
    }
    blocks.push({ id: prefix + '_TENSION', kind: 'paragraph', text: entry.tension });
    return { endingId: namedEnding(entry.name), blocks };
  });
  const referenceId = 'KNOWN_PROJECT_DISTRIBUTED';
  return {
    ...proposal.presentation_identity,
    definitionId: proposal.definition_identity.id,
    definitionVersion: proposal.definition_identity.version,
    endingDefinitionId: proposal.ending_identity.id,
    endingDefinitionVersion: proposal.ending_identity.version,
    references: [
      {
        id: referenceId,
        version: proposal.presentation_identity.version,
        source: 'campaign',
        key: 'ENDING_PRESENTATION_PROJECT_DISTRIBUTED',
        valueType: 'boolean',
      },
    ],
    entries,
    sections: [
      {
        id: 'PROJECT_TITLE_PAYOFF',
        title: 'A distributed project',
        endingIds: endings,
        reveal: { type: 'compare', reference: referenceId, operator: 'eq', expected: true },
        blocks: [
          {
            id: 'PROJECT_TITLE_RECORD',
            kind: 'policy_report',
            provenance: 'authored_policy',
            text: draft.unbound_material.title_payoff.text,
          },
        ],
      },
      {
        id: 'PROMETHEUS_EPILOGUE',
        title: 'Elsewhere',
        endingIds: proposal.proposal.prometheus.eligible_endings.map(namedEnding),
        reveal: { type: 'compare', reference: referenceId, operator: 'eq', expected: true },
        blocks: [
          {
            id: 'PROMETHEUS_LINEAGE',
            kind: 'policy_report',
            provenance: 'authored_future',
            text: proposal.proposal.prometheus.text,
          },
          {
            id: 'PROMETHEUS_INTERPRETATION',
            kind: 'paragraph',
            text: draft.unbound_material.prometheus.interpretation,
          },
        ],
      },
    ],
    closingBlocks: [
      {
        id: 'FINAL_RESPONSIBILITY_QUESTION',
        kind: 'paragraph',
        text: proposal.proposal.title_payoff.final_question,
      },
    ],
  };
}
