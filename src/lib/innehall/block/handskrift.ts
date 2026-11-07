import "server-only";
import { z } from "zod";

/**
 * Det som står skrivet för hand på sajten (src/components/content/handskrift.tsx): anteckningen med pilen mot loggan på
 * startsidan, citaten i sidfoten, där ett av dem väljs slumpvis vid varje besök, och formlerna som skrivs i rutnätet där
 * muspekaren lyser (RutnatLjus). _ och ^ ger index och exponent, som β_1 och x^2. Utan text syns anteckningen inte, och citat
 * utan text hoppas över. Formlerna skrivs i LaTeX (src/lib/latex.ts) och var och en kan skrivas med rödpenna.
 */
export const RITNINGAR = ["understrykning", "ring", "ingen"] as const;

const citat = z.object({
  text: z.string().trim().max(140, "Citatet får vara högst 140 tecken."),
  vem: z.string().trim().max(60, "Namnet får vara högst 60 tecken."),
  ritning: z.enum(RITNINGAR),
});

const formel = z.object({
  tex: z.string().trim().min(1, "Formeln behöver något att skriva.").max(200, "Formeln får vara högst 200 tecken."),
  rod: z.literal(true).optional(),
});

export const handskriftSchema = z.object({
  figur: z.string().trim().max(20, "Anteckningen får vara högst 20 tecken."),
  citat: z.array(citat).max(8, "Högst åtta citat."),
  formler: z.array(formel).max(30, "Högst 30 formler."),
});

/** Formlerna från början, i LaTeX som de står. Var tredje med rödpenna. */
const FORMLER = [
  String.raw`\sigma^2 = E[(X - \mu)^2]`,
  String.raw`\bar{x} = \frac{1}{n}\sum_{i=1}^{n} x_i`,
  String.raw`s^2 = \frac{\sum (x_i - \bar{x})^2}{n - 1}`,
  String.raw`z = \frac{x - \mu}{\sigma}`,
  String.raw`P(A \mid B) = \frac{P(B \mid A)\,P(A)}{P(B)}`,
  String.raw`\hat{y} = \beta_0 + \beta_1 x`,
  String.raw`X \sim N(\mu, \sigma^2)`,
  String.raw`\operatorname{Var}(X) = E[X^2] - E[X]^2`,
  String.raw`r = \frac{\operatorname{Cov}(X, Y)}{\sigma_X \sigma_Y}`,
  String.raw`\bar{x} \pm 1,96 \cdot SE`,
  String.raw`H_0 : \mu = \mu_0`,
  String.raw`p < 0,05`,
  String.raw`R^2 = 1 - \frac{SS_{res}}{SS_{tot}}`,
  String.raw`E[X] = \sum x \cdot p(x)`,
  String.raw`L(\theta) = \prod f(x_i \mid \theta)`,
];

export const HANDSKRIFT = {
  schema: handskriftSchema,
  standard: (): z.output<typeof handskriftSchema> => ({
    figur: "P(kul) = 1",
    citat: [
      { text: "Alla modeller är fel, men vissa är användbara.", vem: "George E. P. Box", ritning: "understrykning" },
      { text: "Det är lätt att ljuga med statistik, men svårt att tala sanning utan den.", vem: "Andrejs Dunkels", ritning: "understrykning" },
      { text: "Utan data är du bara ännu en person med en åsikt.", vem: "W. Edwards Deming", ritning: "ring" },
    ],
    formler: FORMLER.map((tex, i) => (i % 3 === 2 ? { tex, rod: true as const } : { tex })),
  }),
};
