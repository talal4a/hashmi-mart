import { scanTranscript, readOrder, matchCatalog } from '../../src/services/voiceCatalog';
import { auditTranscriptCoverage, repairMissingPhrases } from '../../src/services/voiceCoverage';

describe('Voice Order Understanding Quality Pipeline (Master Test Cases A-G)', () => {
  // TEST A: Items throughout sentence — last item matters as much as the first
  test('Test A: extracts all items throughout sentence including the very last items', () => {
    const transcript = 'do doodh, aik bread, chay anday, phir aik kilo cheeni, Surf aik aur Coke do';
    const matches = scanTranscript(transcript);

    const matchFor = (label: string) =>
      matches.find(m => m.unstocked?.toLowerCase().includes(label.toLowerCase()) || m.productName?.toLowerCase().includes(label.toLowerCase()) || m.query.toLowerCase().includes(label.toLowerCase()));

    const milk = matchFor('milk');
    const bread = matchFor('bread');
    const eggs = matchFor('eggs');
    const sugar = matchFor('sugar');
    const surf = matchFor('surf');
    const coke = matchFor('coca-cola') || matchFor('coke');

    expect(milk).toBeDefined();
    expect(milk?.quantity).toBe(2);

    expect(bread).toBeDefined();
    expect(bread?.quantity).toBe(1);

    expect(eggs).toBeDefined();
    expect(eggs?.quantity).toBe(6);

    expect(sugar).toBeDefined();
    expect(sugar?.quantity).toBe(1);
    expect(sugar?.unit).toBe('kg');

    expect(surf).toBeDefined();
    expect(surf?.quantity).toBe(1);

    expect(coke).toBeDefined();
    expect(coke?.quantity).toBe(2);
  });

  // TEST B: Natural pauses between items
  test('Test B: natural pauses represented in transcript preserve all product groups', () => {
    const transcript = 'milk do ... bread aik ... anday chay ... Coke do';
    const matches = scanTranscript(transcript);

    expect(matches.length).toBeGreaterThanOrEqual(4);
    const milk = matches.find(m => m.unstocked === 'milk' || m.query.includes('milk'));
    const bread = matches.find(m => m.unstocked === 'bread' || m.query.includes('bread'));
    const eggs = matches.find(m => m.unstocked === 'eggs' || m.query.includes('anday'));
    const coke = matches.find(m => m.unstocked === 'Coca-Cola' || m.query.includes('coke'));

    expect(milk?.quantity).toBe(2);
    expect(bread?.quantity).toBe(1);
    expect(eggs?.quantity).toBe(6);
    expect(coke?.quantity).toBe(2);
  });

  // TEST C: Customer self-corrections
  test('Test C: customer correction overrides earlier statement ("doodh do... nahi teen kar do")', () => {
    const transcript = 'doodh do nahi teen kar do';
    const matches = scanTranscript(transcript);

    const milk = matches.find(m => m.unstocked === 'milk' || m.query.includes('doodh'));
    expect(milk).toBeDefined();
    expect(milk?.quantity).toBe(3);
  });

  // TEST D: Mixed language (Urdu, Punjabi, English, Brand names)
  test('Test D: mixed language with Punjabi and brand names', () => {
    const transcript = 'Olpers do pack te bread aik anday chay aur Surf Excel bara wala';
    const matches = scanTranscript(transcript);

    const milk = matches.find(m => m.unstocked === 'milk' || m.query.includes('olpers'));
    const bread = matches.find(m => m.unstocked === 'bread' || m.query.includes('bread'));
    const eggs = matches.find(m => m.unstocked === 'eggs' || m.query.includes('anday'));
    const surf = matches.find(m => m.unstocked === 'Surf Excel' || m.query.includes('surf'));

    expect(milk?.quantity).toBe(2);
    expect(bread?.quantity).toBe(1);
    expect(eggs?.quantity).toBe(6);
    expect(surf).toBeDefined();
  });

  // TEST E: Item added at the very end after closing/filler words
  test('Test E: late item after conversational filler ("...aur haan aik Pepsi bhi")', () => {
    const transcript = 'doodh do bread aik anday chay bas acha theek hai aur haan aik Pepsi bhi';
    const matches = scanTranscript(transcript);

    const pepsi = matches.find(m => m.unstocked === 'Pepsi' || m.query.includes('pepsi'));
    expect(pepsi).toBeDefined();
    expect(pepsi?.quantity).toBe(1);
  });

  // TEST F: Unclear product preserved as unresolved fragment
  test('Test F: unclear grocery phrase is preserved for confirmation instead of dropped', () => {
    const transcript = 'doodh do aur zzzqqqproduct aik';
    const unresolved = ['zzzqqqproduct'];
    const matches = readOrder(
      transcript,
      [{ query: 'milk', quantity: 2 }],
      unresolved,
    );

    const milk = matches.find(m => m.unstocked === 'milk' || m.query === 'milk');
    expect(milk).toBeDefined();
    expect(milk?.quantity).toBe(2);

    const unclear = matches.find(m => m.query.includes('zzzqqqproduct'));
    expect(unclear).toBeDefined();
    expect(unclear?.confidence).toBe('low');
  });

  // TEST G: Long order with 10+ items without first-N truncation
  test('Test G: 10+ items order captures all products without first-N bias', () => {
    const transcript =
      'tamatar do kilo, kela aik darjan, seb teen, kheera char, palak aadha kilo, doodh do, bread aik, anday chay, cheeni aik kilo, Surf aik, Coke do, chai aik packet';
    const matches = scanTranscript(transcript);

    expect(matches.length).toBeGreaterThanOrEqual(10);
    // Stocked items
    expect(matches.find(m => m.productId === 'tomato')?.quantity).toBe(2);
    expect(matches.find(m => m.productId === 'banana')?.quantity).toBe(12);
    expect(matches.find(m => m.productId === 'apple')?.quantity).toBe(3);
    expect(matches.find(m => m.productId === 'cucumber')?.quantity).toBe(4);
    expect(matches.find(m => m.productId === 'spinach')?.quantity).toBe(0.5);

    // Unstocked known items
    expect(matches.find(m => m.unstocked === 'milk')?.quantity).toBe(2);
    expect(matches.find(m => m.unstocked === 'bread')?.quantity).toBe(1);
    expect(matches.find(m => m.unstocked === 'eggs')?.quantity).toBe(6);
    expect(matches.find(m => m.unstocked === 'sugar')?.quantity).toBe(1);
    expect(matches.find(m => m.unstocked === 'Surf Excel')?.quantity).toBe(1);
    expect(matches.find(m => m.unstocked === 'Coca-Cola')?.quantity).toBe(2);
    expect(matches.find(m => m.unstocked === 'tea')?.quantity).toBe(1);
  });

  // TEST H: Pass 2 Coverage Verification & Controlled Repair
  test('Test H: Coverage auditor detects missing items and repairs them', () => {
    const transcript = 'do doodh aik bread chay anday aik kilo cheeni Surf aik aur Coke do';
    // Simulate an incomplete Pass 1 parse that only got the first 3 items:
    const pass1Items = [
      { query: 'milk', quantity: 2 },
      { query: 'bread', quantity: 1 },
      { query: 'eggs', quantity: 6 },
    ];

    const audit = auditTranscriptCoverage(transcript, pass1Items);
    expect(audit.isCovered).toBe(false);
    expect(audit.missingPhrases.length).toBeGreaterThanOrEqual(3);

    // Run readOrder which invokes the coverage check and automatic repair pass
    const finalOrder = readOrder(transcript, pass1Items);
    const sugar = finalOrder.find(m => m.unstocked === 'sugar' || m.query.includes('cheeni'));
    const surf = finalOrder.find(m => m.unstocked === 'Surf Excel' || m.query.includes('surf'));
    const coke = finalOrder.find(m => m.unstocked === 'Coca-Cola' || m.query.includes('coke'));

    expect(sugar).toBeDefined();
    expect(surf).toBeDefined();
    expect(coke).toBeDefined();
  });
});
