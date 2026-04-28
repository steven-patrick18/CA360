import { type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type ReactNode } from 'react'

interface FieldShellProps {
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: ReactNode
}

function FieldShell({ label, required, error, hint, children }: FieldShellProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-600">*</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-slate-500">{hint}</span>
      ) : null}
    </label>
  )
}

const baseInput =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-50'

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  hint?: string
}

export function InputField({ label, error, hint, required, ...rest }: InputFieldProps) {
  return (
    <FieldShell label={label} required={required} error={error} hint={hint}>
      <input
        {...rest}
        required={required}
        className={`${baseInput} ${error ? 'border-red-300' : ''} ${rest.className ?? ''}`}
      />
    </FieldShell>
  )
}

interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
  hint?: string
}

export function TextareaField({ label, error, hint, required, ...rest }: TextareaFieldProps) {
  return (
    <FieldShell label={label} required={required} error={error} hint={hint}>
      <textarea
        {...rest}
        required={required}
        rows={rest.rows ?? 3}
        className={`${baseInput} ${error ? 'border-red-300' : ''} ${rest.className ?? ''}`}
      />
    </FieldShell>
  )
}

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  error?: string
  hint?: string
  options: Array<{ value: string; label: string }>
  placeholder?: string
}

export function SelectField({
  label,
  error,
  hint,
  required,
  options,
  placeholder,
  ...rest
}: SelectFieldProps) {
  return (
    <FieldShell label={label} required={required} error={error} hint={hint}>
      <select
        {...rest}
        required={required}
        className={`${baseInput} bg-white ${error ? 'border-red-300' : ''} ${rest.className ?? ''}`}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  )
}
