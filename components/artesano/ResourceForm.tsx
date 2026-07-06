"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import type {
  Resource,
  ResourceType,
  ResourceContent,
  QuizQuestion,
  VideoContent,
  PresentationContent,
  DocumentContent,
  PdfContent,
  TextContent,
  QuizContent,
} from "@/types";
import { uploadFileResumable } from "@/lib/drive-upload";

interface Props {
  onSubmit: (title: string, type: ResourceType, content: ResourceContent) => Promise<void>;
  onCancel: () => void;
  initialResource?: Resource;
  courseTitle?: string;
  courseId?: string;
}

type SourceMode = "upload" | "text";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEmptyQuestion(optCount = 4): QuizQuestion {
  return {
    questionText: "",
    questionType: "choice",
    options: Array.from({ length: optCount }, () => ""),
    correctIndex: 0,
    multipleChoice: false,
    correctIndexes: [],
  };
}

function initQuestions(resource?: Resource): QuizQuestion[] {
  if (resource?.type === "quiz") {
    return (resource.content as QuizContent).questions.map((q) => ({
      ...q,
      questionType: q.questionType ?? "choice",
      multipleChoice: q.multipleChoice ?? false,
      correctIndex: q.correctIndex ?? 0,
      correctIndexes: q.correctIndexes ?? [],
    }));
  }
  return [makeEmptyQuestion()];
}

function initSourceMode(resource?: Resource): SourceMode {
  if (!resource) return "upload";
  if (resource.type === "text") return "text";
  if (resource.type === "document") {
    const c = resource.content as DocumentContent;
    if (c.body !== undefined && !c.driveUrl) return "text";
  }
  return "upload";
}

const UPLOAD_LABELS: Partial<Record<ResourceType, string>> = {
  video: "Subiendo video...",
  presentation: "Subiendo presentación...",
  document: "Subiendo documento...",
  pdf: "Subiendo PDF...",
};

// ── UploadProgressBar ─────────────────────────────────────────────────────────

function UploadProgressBar({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className="bg-texo-amarillo h-2 rounded-full transition-all duration-200"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── SourceTabs ────────────────────────────────────────────────────────────────

function SourceTabs({
  mode,
  setMode,
  options,
}: {
  mode: SourceMode;
  setMode: (m: SourceMode) => void;
  options: { value: SourceMode; label: string }[];
}) {
  return (
    <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setMode(opt.value)}
          className={`flex-1 text-xs py-1.5 px-2 rounded-md transition-colors font-medium ${
            mode === opt.value
              ? "bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-white"
              : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── ResourceForm ──────────────────────────────────────────────────────────────

export default function ResourceForm({
  onSubmit,
  onCancel,
  initialResource,
  courseTitle = "General",
  courseId = "",
}: Props) {
  const isEditing = !!initialResource;

  const [title, setTitle] = useState(initialResource?.title ?? "");
  const [type, setType] = useState<ResourceType>(
    // Si el recurso es de tipo legacy, mostrarlo en el select pero sin editar tipo
    initialResource?.type ?? "video"
  );
  const [sourceMode, setSourceMode] = useState<SourceMode>(() =>
    initSourceMode(initialResource)
  );

  // Contenido compartido
  const [driveUrl, setDriveUrl] = useState(() => {
    if (!initialResource) return "";
    const t = initialResource.type;
    if (t === "video") return (initialResource.content as VideoContent).driveUrl;
    if (t === "presentation") return (initialResource.content as PresentationContent).driveUrl;
    if (t === "document") return (initialResource.content as DocumentContent).driveUrl ?? "";
    if (t === "pdf") return (initialResource.content as PdfContent).driveUrl;
    return "";
  });

  const [textBody, setTextBody] = useState(() => {
    if (!initialResource) return "";
    const t = initialResource.type;
    if (t === "text") return (initialResource.content as TextContent).body;
    if (t === "document") return (initialResource.content as DocumentContent).body ?? "";
    return "";
  });

  const [questions, setQuestions] = useState<QuizQuestion[]>(() =>
    initQuestions(initialResource)
  );

  const [quizMode, setQuizMode] = useState<"choice" | "open">(() => {
    if (initialResource?.type === "quiz") {
      const qs = (initialResource.content as QuizContent).questions;
      return qs.every((q) => q.questionType === "open") ? "open" : "choice";
    }
    return "choice";
  });

  const [questionCount, setQuestionCount] = useState<number>(() => {
    if (initialResource?.type === "quiz") {
      return Math.min(10, Math.max(1, (initialResource.content as QuizContent).questions.length));
    }
    return 3;
  });

  const [optionsPerQuestion, setOptionsPerQuestion] = useState<number>(() => {
    if (initialResource?.type === "quiz") {
      const first = (initialResource.content as QuizContent).questions[0];
      if (first && first.questionType !== "open") return Math.min(5, Math.max(3, first.options.length));
    }
    return 4;
  });

  // Upload
  const [driveFile, setDriveFile] = useState<File | null>(null);
  const [driveUploadPct, setDriveUploadPct] = useState<number | null>(null);
  const [driveUploadedName, setDriveUploadedName] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    "w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-texo-amarillo focus:border-transparent";

  const fileInputClass =
    "block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-texo-amarillo file:text-texo-azul hover:file:bg-texo-amarillo/90 file:cursor-pointer";

  // ── Quiz handlers ─────────────────────────────────────────────────────────

  function addQuestion() {
    if (questions.length >= 10) return;
    setQuestions((prev) => [...prev, makeEmptyQuestion()]);
  }

  function removeQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  function updateQuestionText(index: number, value: string) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, questionText: value } : q))
    );
  }

  function updateQuestionType(index: number, value: "choice" | "open") {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, questionType: value } : q))
    );
  }

  function updateOption(qIndex: number, oIndex: number, value: string) {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex
          ? { ...q, options: q.options.map((o, j) => (j === oIndex ? value : o)) }
          : q
      )
    );
  }

  function toggleMultipleChoice(qIndex: number) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        const multi = !q.multipleChoice;
        return {
          ...q,
          multipleChoice: multi,
          correctIndex: multi ? undefined : 0,
          correctIndexes: multi ? [] : undefined,
        };
      })
    );
  }

  function updateCorrectIndex(qIndex: number, oIndex: number) {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIndex ? { ...q, correctIndex: oIndex } : q))
    );
  }

  function toggleCorrectIndex(qIndex: number, oIndex: number) {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        const current = q.correctIndexes ?? [];
        const next = current.includes(oIndex)
          ? current.filter((x) => x !== oIndex)
          : [...current, oIndex];
        return { ...q, correctIndexes: next };
      })
    );
  }

  function handleQuestionCountChange(newCount: number) {
    setQuestionCount(newCount);
    setQuestions((prev) => {
      if (newCount > prev.length) {
        const extras = Array.from({ length: newCount - prev.length }, () =>
          quizMode === "open"
            ? { questionText: "", questionType: "open" as const, options: [] }
            : makeEmptyQuestion(optionsPerQuestion)
        );
        return [...prev, ...extras];
      }
      return prev.slice(0, newCount);
    });
  }

  function handleOptionsPerQuestionChange(newOptCount: number) {
    setOptionsPerQuestion(newOptCount);
    setQuestions((prev) =>
      prev.map((q) => {
        const opts = q.options.length < newOptCount
          ? [...q.options, ...Array.from({ length: newOptCount - q.options.length }, () => "")]
          : q.options.slice(0, newOptCount);
        return {
          ...q,
          options: opts,
          correctIndex: Math.min(q.correctIndex ?? 0, newOptCount - 1),
          correctIndexes: (q.correctIndexes ?? []).filter((i) => i < newOptCount),
        };
      })
    );
  }

  // ── Upload ────────────────────────────────────────────────────────────────

  async function uploadToDrive(file: File): Promise<{ directLink: string; pdfFileId?: string }> {
    setDriveUploadPct(0);
    const toastId = toast.loading("Subiendo archivo...");
    try {
      const result = await uploadFileResumable(file, courseTitle, (pct) =>
        setDriveUploadPct(pct),
        courseId
      );
      setDriveUploadPct(null);
      setDriveUploadedName(file.name);
      toast.success("Archivo subido correctamente", { id: toastId });
      return { directLink: result.directLink, pdfFileId: result.pdfFileId };
    } catch (err) {
      setDriveUploadPct(null);
      toast.error("Error al subir el archivo. Intentá de nuevo.", { id: toastId });
      throw err;
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let content: ResourceContent;

      switch (type) {
        case "video": {
          let url = driveUrl;
          if (driveFile) url = (await uploadToDrive(driveFile)).directLink;
          if (!url) { setError("Seleccioná un archivo de video."); setLoading(false); return; }
          content = { driveUrl: url };
          break;
        }
        case "presentation": {
          let url = driveUrl;
          let presPdfFileId: string | undefined;
          if (driveFile) {
            const res = await uploadToDrive(driveFile);
            url = res.directLink;
            presPdfFileId = res.pdfFileId;
          }
          if (!url) { setError("Seleccioná un archivo de presentación."); setLoading(false); return; }
          content = {
            driveUrl: url,
            ...(presPdfFileId ? { pdfFileId: presPdfFileId } : {}),
          };
          break;
        }
        case "document": {
          if (sourceMode === "text") {
            if (!textBody.trim()) { setError("Ingresá el contenido del documento."); setLoading(false); return; }
            content = { body: textBody };
          } else {
            if (driveFile) {
              const { directLink: url, pdfFileId: docPdfFileId } = await uploadToDrive(driveFile);
              content = {
                driveUrl: url,
                fileName: driveFile.name,
                ...(docPdfFileId ? { pdfFileId: docPdfFileId } : {}),
              };
            } else if (isEditing && (initialResource.type === "document" || initialResource.type === "text")) {
              const existing = initialResource.content as DocumentContent;
              content = { ...existing };
            } else {
              setError("Seleccioná un archivo.");
              setLoading(false);
              return;
            }
          }
          break;
        }
        case "pdf": {
          let pdfUrl = driveUrl;
          let pdfFileName: string | undefined;
          if (driveFile) {
            pdfUrl = (await uploadToDrive(driveFile)).directLink;
            pdfFileName = driveFile.name;
          } else if (isEditing && initialResource.type === "pdf") {
            pdfFileName = (initialResource.content as PdfContent).fileName;
          } else if (!pdfUrl) {
            setError("Seleccioná un archivo PDF.");
            setLoading(false);
            return;
          }
          content = {
            driveUrl: pdfUrl,
            ...(pdfFileName ? { fileName: pdfFileName } : {}),
          };
          break;
        }
        case "quiz": {
          const cleanQuestions = questions
            .filter((q) => q.questionText.trim() !== "")
            .map((q) =>
              q.questionType === "open"
                ? {
                    questionText: q.questionText ?? "",
                    questionType: "open" as const,
                    options: [],
                  }
                : {
                    questionText: q.questionText ?? "",
                    questionType: "choice" as const,
                    options: q.options.map((o) => o ?? ""),
                    correctIndex: q.correctIndex ?? 0,
                    multipleChoice: q.multipleChoice ?? false,
                    correctIndexes: q.correctIndexes ?? [],
                  }
            );
          if (cleanQuestions.length === 0) {
            setError("El cuestionario debe tener al menos una pregunta.");
            setLoading(false);
            return;
          }
          content = { questions: cleanQuestions };
          break;
        }
        // legacy — no debería llegar acá desde el form, pero por si acaso
        default:
          setError("Tipo de recurso no válido.");
          setLoading(false);
          return;
      }

      await onSubmit(title, type, content);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Error al guardar el recurso.");
    } finally {
      setLoading(false);
    }
  }

  // ── Render campo de archivo + upload ──────────────────────────────────────

  function renderFileUpload(accept: string, placeholder?: string) {
    return (
      <div>
        {isEditing && driveUrl && !driveFile && !driveUploadedName && (
          <p className="text-xs text-gray-400 mb-2">
            Archivo actual:{" "}
            <a href={driveUrl} target="_blank" rel="noreferrer" className="text-texo-amarillo underline">
              ver en Drive
            </a>
          </p>
        )}
        <input
          type="file"
          accept={accept}
          onChange={(e) => {
            setDriveFile(e.target.files?.[0] ?? null);
            setDriveUploadedName(null);
          }}
          className={fileInputClass}
        />
        {placeholder && <p className="text-xs text-gray-400 mt-1">{placeholder}</p>}
        {driveUploadPct !== null && (
          <UploadProgressBar
            pct={driveUploadPct}
            label={UPLOAD_LABELS[type] ?? "Subiendo..."}
          />
        )}
        {driveUploadedName && (
          <p className="text-xs text-texo-verde mt-2 flex items-center gap-1">
            <span>✓</span>
            <span>{driveUploadedName} subido correctamente</span>
          </p>
        )}
      </div>
    );
  }

const isLegacyType = type === "text" || type === "file";

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 overflow-y-auto py-8 px-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isEditing ? "Editar recurso" : "Nuevo recurso"}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">

          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Título</label>
            <input
              type="text"
              placeholder="Ej: Introducción a los Materiales"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={inputClass}
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipo de recurso</label>
            <select
              value={type}
              onChange={(e) => {
                const t = e.target.value as ResourceType;
                setType(t);
                setSourceMode(t === "document" || t === "text" ? "text" : "upload");
                setDriveUrl("");
                setDriveFile(null);
                setDriveUploadedName(null);
              }}
              disabled={isEditing}
              className={`${inputClass} ${isEditing ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              <option value="video">🎬 Video</option>
              <option value="presentation">📊 Presentación</option>
              <option value="document">📄 Documento</option>
              <option value="pdf">📋 PDF</option>
              <option value="quiz">❓ Cuestionario</option>
              {/* Legacy — solo visible al editar un recurso antiguo */}
              {isLegacyType && <option value={type}>{type === "text" ? "📝 Texto (legado)" : "📎 Archivo (legado)"}</option>}
            </select>
          </div>

          {/* ── Video ──────────────────────────────────────────────────────── */}
          {type === "video" && (
            <div className="flex flex-col gap-3">
              {renderFileUpload("video/*")}
            </div>
          )}

          {/* ── Presentación ───────────────────────────────────────────────── */}
          {type === "presentation" && (
            <div className="flex flex-col gap-3">
              {renderFileUpload(".ppt,.pptx")}
            </div>
          )}

          {/* ── Documento ──────────────────────────────────────────────────── */}
          {type === "document" && (
            <div className="flex flex-col gap-3">
              <SourceTabs
                mode={sourceMode}
                setMode={setSourceMode}
                options={[
                  { value: "text", label: "📝 Escribir texto" },
                  { value: "upload", label: "📁 Subir archivo" },
                ]}
              />
              {sourceMode === "text" && (
                <textarea
                  placeholder="Escribí el contenido del documento aquí..."
                  value={textBody}
                  onChange={(e) => setTextBody(e.target.value)}
                  rows={7}
                  className={`${inputClass} resize-none`}
                />
              )}
              {sourceMode === "upload" && renderFileUpload(".doc,.docx,.txt")}
            </div>
          )}

          {/* ── PDF ────────────────────────────────────────────────────────── */}
          {type === "pdf" && (
            <div className="flex flex-col gap-3">
              {renderFileUpload(".pdf", "El PDF se convertirá a imágenes navegables automáticamente.")}
            </div>
          )}

          {/* ── Cuestionario ───────────────────────────────────────────────── */}
          {type === "quiz" && (
            <div className="flex flex-col gap-4">

              {/* Paso 1: tipo de cuestionario */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Tipo de cuestionario
                </label>
                <div className="flex gap-2">
                  {(["choice", "open"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        setQuizMode(mode);
                        const newType = mode;
                        setQuestions(
                          Array.from({ length: questionCount }, () =>
                            newType === "open"
                              ? { questionText: "", questionType: "open" as const, options: [] }
                              : makeEmptyQuestion(optionsPerQuestion)
                          )
                        );
                      }}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                        quizMode === mode
                          ? "bg-texo-amarillo text-texo-azul border-texo-amarillo"
                          : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-texo-amarillo"
                      }`}
                    >
                      {mode === "choice" ? "✅ Opción múltiple" : "✍️ Respuesta abierta"}
                    </button>
                  ))}
                </div>
                {quizMode === "open" && (
                  <p className="text-xs text-gray-400 mt-1.5">
                    El participante escribirá su respuesta libremente. No se corrige automáticamente — podés revisarla en el panel de Cuestionarios.
                  </p>
                )}
              </div>

              {/* Paso 2: configuración */}
              <div className="flex gap-4 flex-wrap">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Cantidad de preguntas</label>
                  <select
                    value={questionCount}
                    onChange={(e) => handleQuestionCountChange(Number(e.target.value))}
                    className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-texo-amarillo"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                      <option key={n} value={n}>{n} {n === 1 ? "pregunta" : "preguntas"}</option>
                    ))}
                  </select>
                </div>
                {quizMode === "choice" && (
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Opciones por pregunta</label>
                    <select
                      value={optionsPerQuestion}
                      onChange={(e) => handleOptionsPerQuestionChange(Number(e.target.value))}
                      className="border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-texo-amarillo"
                    >
                      <option value={3}>3 opciones</option>
                      <option value={4}>4 opciones</option>
                      <option value={5}>5 opciones</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Preguntas */}
              {questions.map((q, qi) => (
                <div key={qi} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Pregunta {qi + 1}
                  </p>

                  <input
                    type="text"
                    placeholder="Texto de la pregunta"
                    value={q.questionText}
                    onChange={(e) => updateQuestionText(qi, e.target.value)}
                    required
                    className={`${inputClass} mb-3`}
                  />

                  {quizMode === "open" ? (
                    <p className="text-xs text-gray-400">El participante escribirá su respuesta aquí.</p>
                  ) : (
                    <>
                      <label className="flex items-center gap-2 mb-3 cursor-pointer w-fit">
                        <input
                          type="checkbox"
                          checked={q.multipleChoice ?? false}
                          onChange={() => toggleMultipleChoice(qi)}
                          className="accent-texo-amarillo w-4 h-4"
                        />
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          Permite múltiple respuesta
                        </span>
                      </label>

                      <div className="flex flex-col gap-2">
                        {q.options.map((opt, oi) => (
                          <div key={oi} className="flex items-center gap-2">
                            {q.multipleChoice ? (
                              <input
                                type="checkbox"
                                checked={(q.correctIndexes ?? []).includes(oi)}
                                onChange={() => toggleCorrectIndex(qi, oi)}
                                className="accent-texo-verde w-4 h-4 shrink-0"
                                title="Marcar como respuesta correcta"
                              />
                            ) : (
                              <input
                                type="radio"
                                name={`correct-${qi}`}
                                checked={(q.correctIndex ?? 0) === oi}
                                onChange={() => updateCorrectIndex(qi, oi)}
                                className="accent-texo-verde w-4 h-4 shrink-0"
                                title="Marcar como respuesta correcta"
                              />
                            )}
                            <input
                              type="text"
                              placeholder={`Opción ${oi + 1}`}
                              value={opt}
                              onChange={(e) => updateOption(qi, oi, e.target.value)}
                              required
                              className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-texo-amarillo focus:border-transparent"
                            />
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        {q.multipleChoice
                          ? "Marcá todas las respuestas correctas con el checkbox."
                          : "El radio marcado indica la única respuesta correcta."}
                      </p>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Legacy text ─────────────────────────────────────────────────── */}
          {type === "text" && (
            <div>
              <p className="text-xs text-gray-400 mb-2 bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-lg">
                Recurso de texto legado — editá el contenido o creá un nuevo recurso de tipo Documento.
              </p>
              <textarea
                value={textBody}
                onChange={(e) => setTextBody(e.target.value)}
                rows={6}
                className={`${inputClass} resize-none`}
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-texo-rojo bg-texo-rojo/10 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-gray-600 dark:text-gray-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm bg-texo-amarillo text-texo-azul font-semibold rounded-lg hover:bg-texo-amarillo/90 disabled:opacity-50 transition-colors"
            >
              {loading
                ? driveUploadPct !== null
                  ? UPLOAD_LABELS[type] ?? "Subiendo..."
                  : "Guardando..."
                : isEditing
                ? "Guardar cambios"
                : "Guardar recurso"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
