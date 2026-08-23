import { getLessonsForCurriculum } from "../src/lib/content";
const lessons = getLessonsForCurriculum("spanish");
const target = ["ser","llamarse","estar","hablar","querer"];
for (const l of lessons.slice(0, 80)) {
  for (const id of l.plan?.newPhraseIds ?? []) {
    const p = l.phrases.find((x) => x.id === id);
    if (p && target.includes(p.romanized)) console.log(l.id, "introduces", p.romanized, id);
  }
}
