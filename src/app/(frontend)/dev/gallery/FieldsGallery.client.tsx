'use client'

import { Check, Search } from 'lucide-react'
import React, { useState } from 'react'
import { Controller } from 'react-hook-form'
import { z } from 'zod'

import { Button, Field, Form, type FormStatus } from '@/platform/ui'

import { GalleryEntry, GalleryVariant } from './GalleryEntry'
import { SAMPLE_OPTIONS } from './sampleData'

const ERROR = 'Enter a value here.'

/** A `Field.Money` that keeps its own text, as a page would */
function Money() {
  const [value, setValue] = useState('$500,300')
  return <Field.Money value={value} onValueChange={setValue} />
}

/** A money box with its check-mark button inside it, on only while the text differs from the last one sent */
function ActionInside() {
  const [value, setValue] = useState('$500,300')
  const [sent, setSent] = useState('$500,300')
  const ready = value !== sent
  return (
    <Field
      label="Box with its action inside"
      hint="Change the amount to wake the button"
      layout="bar"
      actionPlacement="inside"
      action={
        <Button
          type="button"
          variant="action"
          size="icon-sm"
          aria-label="Send"
          disabled={!ready}
          iconStart={<Check aria-hidden="true" />}
          onClick={() => setSent(value)}
        />
      }
    >
      <Field.Money value={value} onValueChange={setValue} />
    </Field>
  )
}

/** Each `Field` control, without and with an error (client: `Field.Input` and the rest are its parts) */
export function FieldsGallery() {
  return (
    <>
      <GalleryEntry
        name="Field"
        description="Label, required mark, hint and error around exactly one control."
      >
        {[false, true].map((withError) => (
          <GalleryVariant
            key={String(withError)}
            label={withError ? 'with an error' : 'without an error'}
            className="grid w-full gap-6 sm:grid-cols-2"
          >
            <Field label="Input" required hint="A hint under the label" error={err(withError)}>
              <Field.Input type="text" placeholder="text" />
            </Field>
            <Field label="Money input" hint="Digits group as you type" error={err(withError)}>
              <Money />
            </Field>
            <Field label="Email input" error={err(withError)}>
              <Field.Input type="email" autoComplete="email" />
            </Field>
            <Field label="Search input, size lg" error={err(withError)}>
              <Field.Input type="search" size="lg" leadingIcon={<Search />} />
            </Field>
            <Field label="Select" error={err(withError)}>
              <Field.Select options={SAMPLE_OPTIONS} placeholder="Choose a topic" />
            </Field>
            <Field label="Text area, autoGrow" error={err(withError)}>
              <Field.TextArea autoGrow />
            </Field>
            <Field label="Checkbox" hint="Inline layout" error={err(withError)}>
              <Field.Checkbox defaultChecked={!withError} />
            </Field>
          </GalleryVariant>
        ))}
        <GalleryVariant label="layout bar, actionPlacement inside" className="block max-w-sm">
          <ActionInside />
        </GalleryVariant>
        <GalleryVariant label="disabled, hideLabel" className="grid w-full gap-6 sm:grid-cols-2">
          <Field label="Disabled input">
            <Field.Input disabled defaultValue="Can't change this" />
          </Field>
          <Field label="Hidden label" hideLabel>
            <Field.Input placeholder="Label kept for screen readers" />
          </Field>
        </GalleryVariant>
      </GalleryEntry>

      <GalleryEntry
        name="Form"
        description="react-hook-form with a Zod schema. Submit it empty to see the field errors, then filled in to see the success message."
      >
        <GalleryVariant label="status: idle, submitting, success" className="block">
          <SampleForm />
        </GalleryVariant>
        <GalleryVariant label="status: error" className="block">
          <Form
            schema={errorSchema}
            status="error"
            onSubmit={() => undefined}
            aria-label="Sample form that failed"
            className="max-w-2xl"
          >
            {(form) => (
              <Field label="Note" error={form.formState.errors.note?.message}>
                <Field.Input {...form.register('note')} />
              </Field>
            )}
          </Form>
        </GalleryVariant>
      </GalleryEntry>
    </>
  )
}

const err = (show: boolean) => (show ? ERROR : undefined)

const schema = z.object({
  name: z.string().trim().min(1, 'Enter your name.'),
  email: z.email('Enter an email address like name@example.com.'),
  topic: z.string().min(1, 'Choose a topic.'),
  message: z.string().trim().min(1, 'Write a message.'),
  agree: z.boolean().refine(Boolean, 'Tick this box to go on.'),
})

const errorSchema = z.object({ note: z.string().optional() })

type Values = z.input<typeof schema>

function SampleForm() {
  const [status, setStatus] = useState<FormStatus>('idle')

  return (
    <Form
      schema={schema}
      defaultValues={{ topic: '', agree: false }}
      status={status}
      successMessage="Thanks, the sample form was sent. Nothing left this page."
      onSubmit={async () => {
        setStatus('submitting')
        await new Promise((resolve) => setTimeout(resolve, 600))
        setStatus('success')
      }}
      aria-label="Sample form"
      className="max-w-2xl"
    >
      {(form) => (
        <>
          <Field label="Name" required width="half" error={form.formState.errors.name?.message}>
            <Field.Input autoComplete="name" {...form.register('name')} />
          </Field>
          <Field label="Email" required width="half" error={form.formState.errors.email?.message}>
            <Field.Input type="email" autoComplete="email" {...form.register('email')} />
          </Field>
          <Controller<Values, 'topic'>
            control={form.control}
            name="topic"
            render={({ field, fieldState }) => (
              <Field label="Topic" required error={fieldState.error?.message}>
                <Field.Select
                  options={SAMPLE_OPTIONS}
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                />
              </Field>
            )}
          />
          <Field label="Message" required error={form.formState.errors.message?.message}>
            <Field.TextArea {...form.register('message')} />
          </Field>
          <Controller<Values, 'agree'>
            control={form.control}
            name="agree"
            render={({ field, fieldState }) => (
              <Field label="I agree to the sample terms" error={fieldState.error?.message}>
                <Field.Checkbox
                  name={field.name}
                  checked={field.value === true}
                  onCheckedChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                />
              </Field>
            )}
          />
          <div>
            <Button type="submit" loading={status === 'submitting'}>
              Send
            </Button>
          </div>
        </>
      )}
    </Form>
  )
}
