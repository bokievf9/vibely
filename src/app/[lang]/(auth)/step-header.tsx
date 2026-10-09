import { StepProgress } from './step-progress'

// Shared heading block for the sign-up funnel screens. `step` (1-3) shows the progress bar of the
// first-time setup: profile, photos, selfie (sign-in screens have none: returning users see them too).
export function StepHeader({
  title,
  subtitle,
  step,
}: {
  title: string
  subtitle?: string
  step?: number
}) {
  return (
    <div className="mb-8 flex flex-col gap-3">
      {step !== undefined && (
        <div className="mb-3">
          <StepProgress step={step} />
        </div>
      )}
      <h1 className="text-display text-balance">{title}</h1>
      {subtitle && <p className="text-muted text-body text-pretty">{subtitle}</p>}
    </div>
  )
}
