import React from 'react'

/** The plan, with a slot for an issue opened over it as a dialog (#946) */
export default function RoadmapLayout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal: React.ReactNode
}) {
  return (
    <>
      {children}
      {modal}
    </>
  )
}
