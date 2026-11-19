'use client'
import type { Form as FormType } from '@payloadcms/plugin-form-builder/types'

import { useRouter } from 'next/navigation'
import React, { useMemo, useState } from 'react'
import { cn } from '@/platform/lib/cn'
import { RichText } from '@/platform/richtext/RichText'
import { Button, Form, type FormStatus } from '@/platform/ui'
import { Card } from '@/platform/ui/Card'
import type { DefaultTypedEditorState } from '@payloadcms/richtext-lexical'

import { postFormSubmission } from './api'
import { CONFIRM_EMAIL_NOTE } from './confirmEmailNote'
import { FormBuilderField, type FormValues } from './FormBuilderField.client'
import { toDefaultValues, toFormSchema } from './formSchema'
import { toSubmitErrorMessage } from './submitErrorMessage'
import { TurnstileWidget } from '@/platform/turnstile/TurnstileWidget.client'
import { useRobotCheck } from '@/platform/turnstile/useRobotCheck.client'
import { READING_WIDTH_LG } from '@/platform/ui/layoutSizes'

export type FormBlockType = {
  blockName?: string
  blockType?: 'formBlock'
  enableIntro: boolean
  form: FormType
  introContent?: DefaultTypedEditorState
}

export const FormBlock: React.FC<
  {
    id?: string
  } & FormBlockType
> = (props) => {
  const {
    enableIntro,
    form: formFromProps,
    form: {
      id: formID,
      confirmationMessage,
      confirmationType,
      fields = [],
      redirect,
      submitButtonLabel,
    } = {},
    introContent,
  } = props

  const schema = useMemo(() => toFormSchema(fields), [fields])
  const defaultValues = useMemo(() => toDefaultValues(fields), [fields])
  const [status, setStatus] = useState<FormStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const router = useRouter()
  // Spam check (Cloudflare Turnstile): only when a site key is configured
  const robotCheck = useRobotCheck()

  const fail = (message: string) => {
    setErrorMessage(message)
    setStatus('error')
  }

  // `Form` ignores a second submit while this runs, so one single-use token is sent once
  const onSubmit = async (values: FormValues) => {
    const pending = robotCheck.pendingMessage()
    if (pending) {
      fail(pending)
      return
    }
    setStatus('submitting')
    let succeeded = false
    try {
      const response = await postFormSubmission(formID, values, robotCheck.token)
      // The server's own message stays out of the page (#204); the server logs it
      if (!response.ok) {
        fail(toSubmitErrorMessage(response.status))
        return
      }
      succeeded = true
      setStatus('success')
      if (confirmationType === 'redirect' && redirect?.url) router.push(redirect.url)
    } catch {
      fail(toSubmitErrorMessage(null))
    } finally {
      if (!succeeded) robotCheck.renewToken()
    }
  }

  const sent = status === 'success'
  // A message waits for its sender's click (#274), so a form that asks for an email says so
  const asksForEmail = fields.some((field) => field.blockType === 'email')
  const thanks =
    confirmationType === 'message' && confirmationMessage ? (
      <RichText data={confirmationMessage} enableGutter={false} enableProse={false} />
    ) : null

  return (
    <div className={cn('container py-10 md:py-14', READING_WIDTH_LG)}>
      {enableIntro && introContent && !sent && (
        <RichText className="mb-8 lg:mb-12" data={introContent} enableGutter={false} />
      )}
      <Card variant="outline" padding="sm" className="lg:p-6">
        <Form
          id={formID}
          aria-label={formFromProps.title || 'Form'}
          schema={schema}
          defaultValues={defaultValues}
          onSubmit={onSubmit}
          status={status}
          successMessage={
            thanks || asksForEmail ? (
              <>
                {thanks}
                {asksForEmail && (
                  <p className={thanks ? 'mt-2' : undefined}>{CONFIRM_EMAIL_NOTE}</p>
                )}
              </>
            ) : undefined
          }
          errorMessage={errorMessage}
        >
          {/* Once sent, only the confirmation is left */}
          {(form) =>
            !sent && (
              <>
                {fields.map((field, index) => (
                  <FormBuilderField key={index} field={field} form={form} />
                ))}
                <div className="flex flex-col gap-6">
                  {robotCheck.enabled && <TurnstileWidget {...robotCheck.widgetProps} />}
                  <div>
                    <Button
                      fullWidth="mobile"
                      loading={status === 'submitting'}
                      size="lg"
                      type="submit"
                    >
                      {status === 'submitting' ? 'Sending' : submitButtonLabel || 'Send'}
                    </Button>
                  </div>
                </div>
              </>
            )
          }
        </Form>
      </Card>
    </div>
  )
}
