// Inspector copy for the clickable nodes and module rows.
export const modules = {
  wallet: {
    stage: 'STAGE 01 / ACTIVE DESIGN',
    title: 'Wallet',
    text: 'The account at the centre. It turns a stated wish into controlled execution by checking who is acting, what they may touch, and how the owner gets back in if a key is lost.',
    items: [
      'Who holds the account and what each actor may touch',
      'Ceilings, saved destinations and an emergency pause',
      'Ways back in that do not hinge on a single key',
    ],
  },
  credentials: {
    stage: 'STAGE 05 / QUEUED',
    title: 'Credentials',
    text: 'Identity facts, eligibility and track record that live with the owner. An app asks a narrow question and gets an answer, not a stack of documents.',
    items: [
      'Identity credentials issued to the owner',
      'Reputation that follows the wallet',
      'Share one fact and keep the rest sealed',
    ],
  },
  proofs: {
    stage: 'STAGE 05 / QUEUED',
    title: 'Sealed proofs',
    text: 'A ZK layer that lets someone demonstrate a claim is true while the sensitive details stay with them. It protects credentials, not every transaction on the chain.',
    items: [
      'Eligibility confirmed without exposing the file behind it',
      'Reputation shown as a result, not a history',
      'Verification that any app can run',
    ],
  },
  screening: {
    stage: 'STAGE 02 / QUEUED',
    title: 'Screening',
    text: 'Adaptive models read what a request would do and write a short note a person can follow. Their output is advice. They cannot move funds or overrule a rule.',
    items: [
      'Spots open-ended allowances and lookalike contracts',
      'Weighs unusual timing, size and counterparties',
      'Learns from the shared watchlist as it grows',
    ],
  },
  agents: {
    stage: 'STAGE 03 / QUEUED',
    title: 'Agent rails',
    text: 'AI agents can act on a stated goal at machine speed. Rails give each one a narrow key: chosen apps, chosen assets, daily caps and a built-in expiry.',
    items: [
      'One key per agent, never the master key',
      'Hard caps the agent cannot talk its way past',
      'Automatic retirement when the job ends',
    ],
  },
  signatures: {
    stage: 'STAGE 04 / QUEUED',
    title: 'Future-proof signing',
    text: 'Quantum-resistant authorization for the largest moves, with schemes that can be swapped as standards mature, so today’s approvals do not become tomorrow’s weak point.',
    items: [
      'Backup keys registered ahead of need',
      'Extra signature demanded above an owner-set line',
      'Recovery that can use the stronger scheme',
    ],
  },
};
