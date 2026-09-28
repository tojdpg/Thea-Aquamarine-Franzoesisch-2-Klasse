const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { lookup } = require("../docs/dictionary.js");

function questions(file) {
  const source = fs.readFileSync(path.join(__dirname, "..", "docs", file), "utf8")
    .split("const STORAGE_KEY")[0];
  const context = {};
  vm.runInNewContext(`${source}\nglobalThis.items = QUESTIONS;`, context);
  return context.items;
}

test("every adjective and quiz sentence can be translated", () => {
  for (const question of questions("woerter-quiz.js")) {
    assert.ok(lookup(question.sentence), question.sentence);
    for (const choice of question.choices) assert.ok(lookup(choice), choice);
  }
});

test("every gap-dictation sentence can be translated without filling its gap", () => {
  for (const question of questions("lueckendiktat.js")) {
    const sentence = `${question.before}______${question.after}`;
    const translation = lookup(sentence);
    assert.ok(translation, sentence);
    assert.ok(translation.includes("…"), sentence);
  }
});

test("iPad-style entries without accents or articles work", () => {
  assert.equal(lookup("serieuse"), "ernsthaft / gewissenhaft (weiblich)");
  assert.equal(lookup("perroquet"), "der Papagei");
});
