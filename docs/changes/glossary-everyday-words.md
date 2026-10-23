# Glossary: 41 everyday English words no longer kept as names (lane B/D, glossary thread)

- `glossary-data.js`: removed `~You ~One ~Her ~Time ~Think ~Make ~Go ~House ~Yes ~War ~Boy ~Hey ~Air ~Dark ...` (41 single words with word frequency zipf >= 5.0 that are not first names), from the 2.6.x blocks onward. Measured through `protectGlossary` on 3.2M words of movie dialogue: 1,551 false catches gone (You 639, One 130, War 83, Boy 76, Yes 73, Hey 57...), 0 catches lost that were not an everyday word.
- `tools/glossary-filter.py`: `--zipf=`, `--no-shadow`, `--no-extra` for older blocks (`python3 tools/glossary-filter.py 1 --zipf=5.0 --no-shadow --no-extra --names=<nltk names> --write`); in that mode it never adds `~`, which would stop sentence-start catches of London or California.
- Brands such as Apple, Amazon, Twitter stay (zipf < 5.0).
- Vietnamese for version-history: "Bỏ 41 từ tiếng Anh thông dụng (You, One, Time, House...) khỏi danh sách tên riêng, để không giữ nguyên chúng trong câu tiếng Việt."
