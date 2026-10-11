const test = require("node:test");
const assert = require("node:assert/strict");
const { containsRestrictedFood, validateDietPlan } = require("./nutritionSafety");

test("rejects generated diet plans that mention a saved restricted food", () => {
  assert.equal(containsRestrictedFood("A breakfast with peanuts", ["peanuts"]), true);
  assert.equal(containsRestrictedFood("A fruit and oat breakfast", ["peanuts"]), false);
  assert.equal(validateDietPlan(
    "Try a peanut snack [Reviewed nutrition guide].",
    [{ title: "Reviewed nutrition guide" }],
    ["peanut"],
  ), "");
});

test("requires recommendations to cite an exact reviewed source title", () => {
  const sources = [{ title: "Reviewed nutrition guide" }];
  assert.equal(
    validateDietPlan("Choose varied vegetables [Reviewed nutrition guide].", sources),
    "Choose varied vegetables [Reviewed nutrition guide].",
  );
  assert.equal(validateDietPlan("Choose varied vegetables.", sources), "");
  assert.equal(validateDietPlan("Choose varied vegetables [Other source].", sources), "");
});
