// Scripted dry-run examples. Invented rules and amounts; nothing is connected to a wallet.
export const scenarios = {
  everyday: {
    amount: '250',
    unit: 'USDC',
    desc: 'A routine payment to an address the owner saved before.',
    dest: 'Saved contact',
    rule: 'Under daily ceiling',
    proof: 'Owner signature',
    steps: [
      'Plain payment, no contract call.',
      'Only the stated token leaves. No allowances change.',
      'Amount sits under the owner-set ceiling.',
      'The owner signature already covers this rule.',
    ],
    marks: ['READ', 'CLEAN', 'PASS', 'SIGNED'],
    title: 'Cleared to send',
    detail: 'The rules allow it once the owner signs. In this example no funds move.',
  },
  agent: {
    amount: '4,800',
    unit: 'USDC',
    desc: 'An AI agent holding a 1,000 USDC daily key tries to push through a much bigger swap.',
    dest: 'App outside its list',
    rule: 'Agent cap: 1,000 per day',
    proof: 'None can lift it',
    steps: [
      'Swap requested by an agent key, not the owner.',
      'The target app is not on this agent’s approved list.',
      'Amount is almost five times the key’s daily cap.',
      'The wallet refuses to sign for this key.',
    ],
    marks: ['READ', 'WARNING', 'CAP HIT', 'REFUSED'],
    title: 'Agent held in bounds',
    detail: 'The agent can keep working inside its lane, but this request is turned away. Only the owner can widen the lane.',
  },
  large: {
    amount: '52,000',
    unit: 'USDC',
    desc: 'A big send to an address this wallet has never used.',
    dest: 'Brand-new address',
    rule: 'Over the 25,000 line',
    proof: 'Owner + quantum-resistant key',
    steps: [
      'Large payment to a first-time destination.',
      'Amount and destination are both unusual for this wallet.',
      'The example rule asks for a second, stronger signature.',
      'Held until that extra signature arrives.',
    ],
    marks: ['READ', 'UNUSUAL', 'ESCALATED', 'ON HOLD'],
    title: 'Needs the stronger key',
    detail: 'The send waits in place. It is released only when the quantum-resistant signature the rule demands is supplied.',
  },
};

export const defaultSteps = [
  'Work out what is being asked.',
  'Replay it and read the risk.',
  "Compare against the owner's rules.",
  'Decide whether it may go out.',
];
