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
  return (
    <Link
      href={href}
      className="group border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden hover:shadow-xl hover:border-texo-amarillo transition-all duration-200 bg-white dark:bg-gray-900 flex flex-col"
    >
      {/* Cover */}
      {coverImageUrl ? (
        <div className="relative h-[280px] bg-gray-100 dark:bg-gray-800">
          <Image
            src={coverImageUrl}
            alt={title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      ) : (
        <div className="h-[280px] bg-gradient-to-br from-texo-azul to-texo-verde flex items-center justify-center">
          <span className="text-white font-bold opacity-30 select-none" style={{ fontSize: "80px", lineHeight: 1 }}>
            {title.charAt(0).toUpperCase()}
          </span>
        </div>
      )}

      {/* Body */}
      <div className="p-4 flex flex-col gap-2 flex-1">
        {courseNumber !== undefined && (
          <p className="text-[13px] font-semibold text-texo-amarillo">
            Propedéutico TEXO N° {courseNumber}
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

        {/* Progress or CTA */}
        <div className="mt-auto pt-3">
          {progressPct !== undefined ? (
            <>
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
            </>
          ) : action ? (
            action
          ) : (
            <span className="text-xs text-texo-amarillo font-semibold">
              Empezar →
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
