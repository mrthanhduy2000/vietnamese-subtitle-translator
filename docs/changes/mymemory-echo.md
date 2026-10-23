# MyMemory echo of a non-Latin source is rejected (background.js, lane D)

`callMyMemoryTranslate` reads sl="auto" as English. A Chinese/Thai/Arabic line came back unchanged
and was shown as its own "translation". An answer identical to a source with no Latin letter is now
rejected (the line stays blank and is retried). Test: `tests/mymemory-quota.test.js`.
