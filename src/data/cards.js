/* ═══════════════════════════════════════════
   Surprise and Treasure decks
   effect types:
     cash        { amount }            + or − from the bank
     collectEach { amount }            every other player pays you
     payEach     { amount }            you pay every other player
     move        { to, back }          walk to a tile (back = no GO salary)
     moveBy      { steps }             shuffle forward or back
     nearest     { kind, multiplier }  walk to the next airport/utility
     repairs     { house, hotel }      pay per building you own
     jail        {}                    straight to the cell
     getOut      {}                    keep the card, skip a jail turn later
   ═══════════════════════════════════════════ */
window.MM = window.MM || {};

MM.DECKS = {
  surprise: [
    { text: "Advance to START and collect your salary.", effect: { type: "move", to: 0 } },
    { text: "Take a trip to JFK Airport.", effect: { type: "move", to: 35 } },
    { text: "The board's hottest address calls — advance to New York.", effect: { type: "move", to: 39 } },
    { text: "Advance to Mumbai.", effect: { type: "move", to: 6 } },
    { text: "You overshot. Go back three tiles.", effect: { type: "moveBy", steps: -3 } },
    { text: "Caught cooking the books. Go directly to prison.", effect: { type: "jail" } },
    { text: "Your lawyer earns her fee — get out of prison free.", effect: { type: "getOut" } },
    { text: "The bank pays you a dividend of $50.", effect: { type: "cash", amount: 50 } },
    { text: "Speeding fine — pay $15.", effect: { type: "cash", amount: -15 } },
    { text: "Your building loan matures — collect $150.", effect: { type: "cash", amount: 150 } },
    { text: "General repairs on everything you own: $25 per house, $100 per hotel.",
      effect: { type: "repairs", house: 25, hotel: 100 } },
    { text: "Advance to the nearest airport and pay the owner double.",
      effect: { type: "nearest", kind: "airport", multiplier: 2 } },
    { text: "Advance to the nearest utility. Rent is ten times your roll.",
      effect: { type: "nearest", kind: "utility", multiplier: 10 } },
    { text: "You are elected chair of the board — pay each player $50.",
      effect: { type: "payEach", amount: 50 } }
  ],

  treasure: [
    { text: "Bank error in your favour — collect $200.", effect: { type: "cash", amount: 200 } },
    { text: "Doctor's fee — pay $50.", effect: { type: "cash", amount: -50 } },
    { text: "Sale of stock — collect $50.", effect: { type: "cash", amount: 50 } },
    { text: "A friend on the inside — get out of prison free.", effect: { type: "getOut" } },
    { text: "Auditors did not like what they found. Go to prison.", effect: { type: "jail" } },
    { text: "Holiday fund matures — collect $100.", effect: { type: "cash", amount: 100 } },
    { text: "Income tax refund — collect $20.", effect: { type: "cash", amount: 20 } },
    { text: "It's your birthday — collect $10 from every player.",
      effect: { type: "collectEach", amount: 10 } },
    { text: "Life insurance matures — collect $100.", effect: { type: "cash", amount: 100 } },
    { text: "Hospital fees — pay $100.", effect: { type: "cash", amount: -100 } },
    { text: "School fees — pay $50.", effect: { type: "cash", amount: -50 } },
    { text: "You inherit $100.", effect: { type: "cash", amount: 100 } },
    { text: "Street repairs: $40 per house, $115 per hotel.",
      effect: { type: "repairs", house: 40, hotel: 115 } },
    { text: "Second prize in a beauty contest — collect $10.", effect: { type: "cash", amount: 10 } }
  ]
};
