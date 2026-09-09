'use client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import React, { useState } from 'react'
import { Label } from '@/components/ui/label'
import { db } from '@/lib/Supabase/supabaseClient'

export default function ARegUser() {

  




  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setloading] = useState(false)
  // const [status, setStatus] = useState<'Not Saved' | 'Enabled' | 'Saving'>('Not Saved')

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setloading(true)
    if (!email || !password) {
      toast.warning('Please fill in email and password first.')
      return
    }

    // setStatus('Saving')

    try {
      const { data: sessionData } = await db.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) throw new Error('Authentication required.')
      const res = await fetch('/api/admin/createUser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()
      if (res.ok) {
        toast.success(`✅ User created: ${data.user.email}`)
        // setStatus('Enabled')
      } else {
        toast.error(data.error || 'Failed to create user.')
        // setStatus('Not Saved')
      }
    } catch (err) {
      console.error(err)
      toast.error('Something went wrong.')
      setloading(false)

      // setStatus('Not Saved')
    }
    setloading(false)

  }

  return (
    <div className=''>

      <form
        onSubmit={handleCreateUser}
        className=''
      >
        <div className='mt-2'>
          <Label>Email</Label>
          <Input
            type='email'
            required
            placeholder='User email'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className='mt-2'>
          <Label>Password</Label>
          <Input
            type='password'
            required
            placeholder='User password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

        </div>
        <div className='col-span-2 flex justify-end mt-4'>
          <Button type='submit' disabled={loading}>
            {/* Create User */}
            {loading ? "Loading" : "Create User"}
          </Button>
        </div>
      </form>
    </div>
  )
}
