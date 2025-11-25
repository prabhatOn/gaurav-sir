"use client"

import React from 'react'
import { Dialog, DialogContent, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'

type ColumnOption = { id: string; label: string }

export default function ColumnSettings({ open, onOpenChange, columns, selected, onSave, onReset }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  columns: ColumnOption[]
  selected: Record<string, boolean>
  onSave: (selected: Record<string, boolean>) => void
  onReset: () => void
}) {
  const [local, setLocal] = React.useState<Record<string, boolean>>(selected)

  React.useEffect(() => setLocal(selected), [selected])

  const toggle = (id: string) => setLocal(prev => ({ ...prev, [id]: !prev[id] }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[380px] p-0 overflow-hidden">
        <div className="bg-red-700 text-white px-4 py-3 flex items-center justify-between">
          <div className="text-lg font-semibold">Column Setting</div>
          <DialogClose>
            <span className="size-5">✕</span>
          </DialogClose>
        </div>

        <div className="p-4 max-h-[340px] overflow-auto">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 items-center text-sm">
            <div className="font-semibold text-gray-700">Column</div>
            <div className="font-semibold text-gray-700">Select Column</div>
            {columns.map(col => (
              <React.Fragment key={col.id}>
                <div className="text-gray-700">{col.label}</div>
                <div className="flex justify-end">
                  <Checkbox className="data-[state=checked]:bg-red-600 data-[state=checked]:border-red-600" checked={!!local[col.id]} onCheckedChange={() => toggle(col.id)} />
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        <DialogFooter className="px-4 py-4">
          <div className="flex items-center justify-between w-full">
            <button className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded" onClick={() => onOpenChange(false)}>CANCEL</button>
            <button className="px-4 py-2 text-sm bg-red-600 text-white rounded" onClick={() => { onSave(local); onOpenChange(false) }}>SAVE SETTING</button>
          </div>
          <div className="mt-3">
            <button className="w-full px-4 py-3 text-sm border border-red-600 text-red-600 rounded" onClick={() => { onReset(); onOpenChange(false) }}>RESET COLUMN SETTING AND POSITION</button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
