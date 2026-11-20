'use client'

import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import React, { useEffect, useRef, useState } from 'react'

import { message } from '@/platform/lib'
import { Alert, Button } from '@/platform/ui'
import { DateTime } from '@/platform/ui/DateTime'
import { Dialog } from '@/platform/ui/Dialog.client'
import { MetaList } from '@/platform/ui/MetaList'
import { Text } from '@/platform/ui/Text'

import { removePasskey } from '../actions'
import type { PasskeyListItem } from '../domain/removePasskey'
import { LogInAgainButton } from './LogInAgainButton.client'
import {
  toRemovePasskeyNotice,
  type PasskeyNotice,
  type RemovePasskeyOutcome,
} from './passkeyMessages'

/**
 * Sends the removal and turns every way it can end into one outcome; nothing the server says is
 * passed on as text. A request that gets no answer is `offline`.
 */
async function removeOne(passkeyId: number): Promise<RemovePasskeyOutcome> {
  try {
    const result = await removePasskey({ passkeyId })
    return result.ok ? 'removed' : result.failure
  } catch {
    return 'offline'
  }
}

/** A passkey's name as the list and the confirmation show it: bold, and wrapping inside its box. */
function PasskeyName({ label }: { label: string }) {
  return <p className="font-semibold wrap-anywhere text-foreground">{label}</p>
}

type RemoveDialogProps = {
  passkey: PasskeyListItem
  open: boolean
  removing: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

/**
 * One passkey's "Remove passkey" button and the dialog that asks first. The button is the dialog's
 * own trigger, so focus moves into the dialog and goes back to the button when it closes.
 */
function RemoveDialog({ passkey, open, removing, onOpenChange, onConfirm }: RemoveDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={message('accounts.passkey.removeTitle')}
      placement="center"
      className="max-w-md"
      trigger={
        <Button
          variant="secondary"
          fullWidth="mobile"
          className="whitespace-nowrap"
          aria-label={`Remove passkey: ${passkey.label}`}
          iconStart={<Trash2 aria-hidden />}
        >
          Remove passkey
        </Button>
      }
    >
      <div className="space-y-4 p-6">
        <PasskeyName label={passkey.label} />
        <Text variant="small">{message('accounts.passkey.removeConfirm')}</Text>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" loading={removing} onClick={onConfirm}>
            Remove passkey
          </Button>
          <Button disabled={removing} onClick={() => onOpenChange(false)}>
            Keep it
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

type Props = {
  /** The signed-in account's passkeys, from the page: the account never comes from here */
  passkeys: PasskeyListItem[]
}

/**
 * The passkeys on /account (#1316, decision 0021): each with its name, when it was added and last
 * used, and "Remove passkey", which asks to confirm in a dialog. The list comes from the server
 * page as plain props; a removed row leaves at once and the page refreshes behind it. Only the
 * passkey's id is sent, and the server finds the account from the session. An old sign-in is asked
 * to log in again, like adding one. Shows even where the browser can't make a passkey, so a
 * neighbor can still remove one.
 */
export function PasskeyList({ passkeys }: Props) {
  const router = useRouter()
  const [target, setTarget] = useState<PasskeyListItem | null>(null)
  const [removing, setRemoving] = useState(false)
  const [gone, setGone] = useState<ReadonlySet<number>>(new Set())
  const [notice, setNotice] = useState<PasskeyNotice | null>(null)
  const noticeBox = useRef<HTMLDivElement>(null)
  const items = passkeys.filter(({ id }) => !gone.has(id))

  // A new message takes focus: the row that had it may be gone
  useEffect(() => {
    if (notice) noticeBox.current?.focus()
  }, [notice])

  const confirm = async () => {
    if (!target) return
    setRemoving(true)
    const outcome = await removeOne(target.id)
    setRemoving(false)
    setNotice(toRemovePasskeyNotice(outcome))
    if (outcome === 'removed') {
      setGone((before) => new Set(before).add(target.id))
      router.refresh()
    }
    setTarget(null)
  }

  return (
    <div className="space-y-4">
      {notice && (
        <div ref={noticeBox} tabIndex={-1} className="space-y-4 outline-none">
          <Alert tone={notice.tone}>{notice.text}</Alert>
          {notice.logInAgain && (
            <LogInAgainButton onFailed={() => setNotice(toRemovePasskeyNotice('offline'))} />
          )}
        </div>
      )}
      {items.length === 0 ? (
        <Text variant="small">{message('accounts.passkey.none')}</Text>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((passkey) => (
            <li
              key={passkey.id}
              className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-2">
                <PasskeyName label={passkey.label} />
                <MetaList
                  items={[
                    { label: 'Added', value: <DateTime value={passkey.addedAt} /> },
                    {
                      label: 'Last used',
                      value: passkey.lastUsedAt ? (
                        <DateTime value={passkey.lastUsedAt} />
                      ) : (
                        'Not used yet'
                      ),
                    },
                  ]}
                />
              </div>
              <div className="sm:shrink-0">
                <RemoveDialog
                  passkey={passkey}
                  open={target?.id === passkey.id}
                  removing={removing}
                  onOpenChange={(open) => {
                    if (open) setNotice(null)
                    if (!open && removing) return
                    setTarget(open ? passkey : null)
                  }}
                  onConfirm={confirm}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <Text variant="small">{message('accounts.passkey.lostDevice')}</Text>
    </div>
  )
}
