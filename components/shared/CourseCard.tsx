import Link from "next/link";
import Image from "next/image";

interface CourseCardProps {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  courseNumber?: number;
  /** 0-100 */
  progressPct?: number;
  progressLabel?: string;
  href: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
}

export default function CourseCard({
  title,
  description,
  coverImageUrl,
  courseNumber,
  progressPct,
  progressLabel,
  href,
  badge,
  action,
}: CourseCardProps) {
  const isCompleted = progressPct === 100;
  const isInProgress = progressPct !== undefined && progressPct > 0 && progressPct < 100;
  const isNotStarted = progressPct === undefined || progressPct === 0;

  const btnLabel = isCompleted ? "Repasar →" : isInProgress ? "Continuar →" : "Empezar →";
  const btnStyle = isCompleted
    ? "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
    : isInProgress
    ? "bg-texo-verde text-white"
    : "bg-texo-amarillo text-texo-azul";

  return (
    <Link
      href={href}
      className="group border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden hover:shadow-xl hover:border-texo-amarillo transition-all duration-200 bg-white dark:bg-gray-900 flex flex-col"
    >
      {/* Cover */}
      <div className="relative h-[280px] bg-gray-100 dark:bg-gray-800">
        {coverImageUrl ? (
          <Image
            src={coverImageUrl}
            alt={title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/LA_ACADEMIA_NEWSLETTER.png"
            alt="Academia TEXO"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
          />
        )}

        {/* Badge completado */}
        {isCompleted && (
          <div className="absolute top-3 right-3 bg-texo-verde text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow">
            ✓ Completado
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        {courseNumber !== undefined && (
          <p className="text-[13px] font-semibold text-texo-amarillo">
            Propedéutico TEXO N° {/* {courseNumber} */}
          </p>
        )}
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-semibold leading-tight line-clamp-2 text-gray-900 dark:text-white">
            {title}
          </h2>
          {badge}
        </div>

        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
            {description}
          </p>
        )}

        {/* Progress bar */}
        {progressPct !== undefined && progressPct > 0 && (
          <div className="mt-auto pt-2">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{progressLabel ?? `${progressPct}% completado`}</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-texo-verde rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}

        {/* Action button */}
        {action ? (
          <div className="mt-auto pt-2">{action}</div>
        ) : (
          <div className={`mt-auto pt-2 w-full text-center text-sm font-semibold py-2 rounded-lg transition-colors ${btnStyle}`}>
            {isNotStarted && progressPct === undefined ? "Empezar →" : btnLabel}
          </div>
        )}
      </div>
    </Link>
  );
}
