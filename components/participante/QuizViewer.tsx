"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import type { QuizContent } from "@/types";

import type { QuizAnswer } from "@/types";

interface Props {
  content: QuizContent;
  onComplete: (score: number, answers: QuizAnswer[]) => Promise<void>;
}

// Por pregunta: null = sin responder (single) | number = respuesta single | number[] = múltiples | string = respuesta abierta
type AnswerValue = null | number | number[] | string;

export default function QuizViewer({ content, onComplete }: Props) {
  const [answers, setAnswers] = useState<AnswerValue[]>(
    content.questions.map((q) => {
      if (q.questionType === "open") return "";
      return q.multipleChoice ? [] : null;
    })
  );
  const [loading, setLoading] = useState(false);

  const allAnswered = answers.every((a, i) => {
    const q = content.questions[i];
    if (q.questionType === "open") {
      return typeof a === "string" && a.trim() !== "";
    }
    if (q.multipleChoice) {
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

  function updateOpenAnswer(qi: number, value: string) {
    setAnswers((prev) => prev.map((a, i) => (i === qi ? value : a)));
  }

  async function handleSubmit() {
    if (!allAnswered) return;

    const graded = content.questions.filter((q) => q.questionType !== "open");

    const score = answers.reduce<number>((acc, answer, i) => {
      const q = content.questions[i];
      if (q.questionType === "open") return acc;
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

    const total = graded.length;
    toast.success(
      total > 0
        ? `Cuestionario completado — ${score}/${total} respuestas correctas`
        : "Cuestionario completado — respuestas registradas"
    );
    setLoading(true);
    const serialized: QuizAnswer[] = answers.map((a, i) => {
      const q = content.questions[i];
      if (q.questionType === "open") {
        return { questionIndex: i, selectedOptions: [], textAnswer: typeof a === "string" ? a : "" };
      }
      return {
        questionIndex: i,
        selectedOptions: Array.isArray(a) ? a : a !== null && typeof a === "number" ? [a] : [],
      };
    });
    await onComplete(score, serialized);
  }

  return (
    <div className="flex flex-col gap-6">
      {content.questions.map((q, qi) => {
        const isOpen = q.questionType === "open";
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
              {!isOpen && isMultiple && (
                <span className="shrink-0 text-xs bg-texo-azul/10 dark:bg-white/10 text-texo-azul dark:text-white px-2 py-0.5 rounded-full">
                  Múltiple
                </span>
              )}
            </div>

            {isOpen ? (
              <textarea
                value={typeof currentAnswer === "string" ? currentAnswer : ""}
                onChange={(e) => updateOpenAnswer(qi, e.target.value)}
                placeholder="Escribí tu respuesta..."
                rows={4}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-texo-amarillo resize-y min-h-[100px]"
              />
            ) : (
              <>
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
              </>
            )}
          </div>
        );
      })}

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
