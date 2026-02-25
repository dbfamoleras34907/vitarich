'use client'
import { useParams } from 'next/navigation'
import React from 'react'

export default function Layout() {
    const { docentry } = useParams()
    // GET: EGGSTORAGE INFO ID = docentry
    return (
        <div>{docentry}</div>
    )
}
