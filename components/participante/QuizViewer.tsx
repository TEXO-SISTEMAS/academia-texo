"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import type { QuizContent } from "@/types";

import type { QuizAnswer } from "@/types";

interface Props {
  content: QuizContent;
  onComplete: (score: number, answers: QuizAnswer[], observations?: string) => Promise<void>;
}

// Por pregunta: null = sin responder (single) | number = respuesta single | number[] = respuestas múltiples
type AnswerValue = null | number | number[];

export default function QuizViewer({ content, onComplete }: Props) {
  const [answers, setAnswers] = useState<AnswerValue[]>(
    content.questions.map((q) => (q.multipleChoice ? [] : null))
  );
  const [observations, setObservations] = useState("");
  const [loading, setLoading] = useState(false);

  const allAnswered = answers.every((a, i) => {
    if (content.questions[i].multipleChoice) {
      return Array.isArray(a) && a.length > 0;
    }
    return a !== null;
  });

  function selectSingleAnswer(qi: number, oi: number) {
    setAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)));
  }

  function toggleMultiAnswer(qi: number, oi: number) {
    setAnswers((prev) =>
      prev.map((a, i) => {
        if (i !== qi) return a;
        const current = Array.isArray(a) ? a : [];
        return current.includes(oi)
          ? current.filter((x) => x !== oi)
          : [...current, oi];
      })
    );
  }

  async function handleSubmit() {
    if (!allAnswered) return;

    const score = answers.reduce<number>((acc, answer, i) => {
      const q = content.questions[i];
      if (q.multipleChoice && Array.isArray(answer)) {
        const correct = q.correctIndexes ?? [];
        const isCorrect =
          answer.length === correct.length &&
          answer.every((x) => correct.includes(x));
        return acc + (isCorrect ? 1 : 0);
      }
      // Respuesta única — compatibilidad con correctIndex legacy
      return acc + (answer === (q.correctIndex ?? 0) ? 1 : 0);
    }, 0);

    const total = content.questions.length;
    toast.success(`Cuestionario completado — ${score}/${total} respuestas correctas`);
    setLoading(true);
    const serialized: QuizAnswer[] = answers.map((a, i) => ({
      questionIndex: i,
      selectedOptions: Array.isArray(a) ? a : a !== null ? [a as number] : [],
    }));
    const obs = content.allowObservations && observations.trim() ? observations.trim() : undefined;
    await onComplete(score, serialized, obs);
  }

  return (
    <div className="flex flex-col gap-6">
      {content.questions.map((q, qi) => {
        const isMultiple = q.multipleChoice ?? false;
        const currentAnswer = answers[qi];

        return (
          <div
            key={qi}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5"
          >
            <div className="flex items-start justify-between gap-2 mb-4">
              <p className="font-semibold text-gray-900 dark:text-white text-sm">
                {qi + 1}. {q.questionText}
              </p>
              {isMultiple && (
                <span className="shrink-0 text-xs bg-texo-azul/10 dark:bg-white/10 text-texo-azul dark:text-white px-2 py-0.5 rounded-full">
                  Múltiple
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2">
              {q.options.map((opt, oi) => {
                const selected = isMultiple
                  ? Array.isArray(currentAnswer) && currentAnswer.includes(oi)
                  : currentAnswer === oi;

                return (
                  <label
                    key={oi}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer select-none transition-colors text-sm ${
                      selected
                        ? "border-texo-amarillo bg-texo-amarillo/10 text-gray-900 dark:text-white"
                        : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {isMultiple ? (
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleMultiAnswer(qi, oi)}
                        className="accent-texo-amarillo w-4 h-4 shrink-0"
                      />
                    ) : (
                      <input
                        type="radio"
                        name={`q-${qi}`}
                        checked={selected}
                        onChange={() => selectSingleAnswer(qi, oi)}
                        className="accent-texo-amarillo w-4 h-4 shrink-0"
                      />
                    )}
                    {opt}
                  </label>
                );
              })}
            </div>

            {isMultiple && (
              <p className="text-xs text-gray-400 mt-2">
                Seleccioná todas las opciones correctas.
              </p>
            )}
          </div>
        );
      })}

      {content.allowObservations && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {content.observationsLabel || "Observaciones"} <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            placeholder="Escribí tus comentarios o dudas sobre este cuestionario..."
            rows={3}
            className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-texo-amarillo resize-none"
          />
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!allAnswered || loading}
        className="bg-texo-amarillo text-texo-azul font-semibold px-6 py-2.5 rounded-lg text-sm hover:bg-texo-amarillo/90 disabled:opacity-50 self-start transition-colors"
      >
        {loading ? "Enviando..." : "Enviar respuestas"}
      </button>
    </div>
  );
}
