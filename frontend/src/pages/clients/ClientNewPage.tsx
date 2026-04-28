import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ClientForm from '../../components/ClientForm'
import { clientsApi } from '../../lib/clients-api'
import { useToast, getApiErrorMessage } from '../../lib/toast'
import type { CreateClientPayload } from '../../lib/api-types'

export default function ClientNewPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(payload: CreateClientPayload) {
    setSubmitting(true)
    try {
      const created = await clientsApi.create(payload)
      toast.success(`Client #${created.srNo} (${created.name}) created`)
      navigate(`/clients/${created.id}`)
    } catch (err) {
      toast.error(getApiErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <Link to="/clients" className="text-sm text-blue-600 hover:underline">
          ← Back to clients
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">New client</h1>
        <p className="mt-1 text-sm text-slate-500">
          Required fields are marked with <span className="text-red-600">*</span>. Sr No is assigned
          automatically.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <ClientForm mode="create" onSubmit={handleSubmit as never} submitting={submitting} />
      </div>
    </div>
  )
}
