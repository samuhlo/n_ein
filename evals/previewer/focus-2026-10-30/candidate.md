# Review focus experiment

Before reading deeply, identify at most three consequential guarantees changed by this diff. Choose from persistence/recovery, concurrency/cleanup, producer-consumer compatibility, and the user's visible outcome. Skip categories the change does not affect. Work sequentially in this same review; do not launch extra reviewers.

For each chosen guarantee, trace one operation across its actual entry point, changed decision, stored state and consuming code. Try a concrete counterexample at the weakest boundary. Include an unchanged valid case when assessing a validator. Compare the suspect behaviour with the base before attributing a regression.

After those traces, inspect the remaining changed files for a different class of defect; the selected focus must not hide an obvious defect elsewhere. A complete source list or a green suite is not behavioural coverage.

In the summary, briefly name the behaviours actually examined. Put consequential boundaries you could not inspect or execute in gaps, with the missing evidence. Do not claim every category was checked merely because you selected it. Keep the existing finding, citation and probe protocol unchanged; no requirement for a minimum number of findings.
