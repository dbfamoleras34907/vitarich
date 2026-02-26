
"use client"

export const dynamic = 'force-dynamic'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table" 
import NavigationBar from "@/components/ui/sidebar/NavigationBar"

export default function DisposalReleaseLayout() {

  return (
      <div>
        <NavigationBar currentLabel='' fatherLink='./' fatherLabel=''>
                   
            <Card className="max-w-7xl mx-auto">
              <CardHeader>
                <CardTitle>Delivery Receipt â€“ Disposal / Release</CardTitle>
              </CardHeader>

              <CardContent className="space-y-6">

                {/* ===== HEADER ===== */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Field label="Date">
                      <Input defaultValue="01/01/2026" readOnly />
                    </Field>

                    <Field label="Customer Name">
                      <Input placeholder="Enter customer name" />
                    </Field>

                    <Field label="Contact No.">
                      <Input placeholder="Enter contact number" />
                    </Field>
                  </div>

                  <div className="space-y-3">
                    <Field label="Delivery Receipt No.">
                      <Input defaultValue="DR-11XXX11" readOnly />
                    </Field>

                    <Field label="Customer Address">
                      <Input placeholder="Enter address" />
                    </Field>

                    <Field label="Mode of Release">
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Pick up / Delivery" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pickup">Pick Up</SelectItem>
                          <SelectItem value="delivery">Delivery</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                </div>

                {/* ===== BATCH / SKU ===== */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-6">
                  <div className="space-y-3">
                    <Field label="DOC Batch Code">
                      <Input defaultValue="001FARM1B1P1-010126-B1%Sequence%" />
                    </Field>

                    <Field label="SKU Classification">
                      <Input defaultValue="DISPOSAL" readOnly />
                    </Field>
                  </div>

                  <div className="space-y-3">
                    <Field label="Qty">
                      <Input defaultValue="100" />
                    </Field>

                    <Field label="SKU Name">
                      <Input defaultValue="CC / UH / DP / RT" />
                    </Field>

                    <Button className="w-fit mt-6">Add Item</Button>
                  </div>
                </div>

                {/* ===== ITEMS TABLE ===== */}
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Doc Batch Code</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>UoM</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {[
                        { sku: "CC", desc: "Cull Chick" },
                        { sku: "UH", desc: "Unhatched" },
                        { sku: "DP", desc: "Dead Pip" },
                        { sku: "RT", desc: "Rotten" },
                      ].map((item) => (
                        <TableRow key={item.sku}>
                          <TableCell>
                            <Button size="sm" variant="destructive">
                              Remove
                            </Button>
                          </TableCell>
                          <TableCell>
                            001FARM1B1P1-010126-B1%
                          </TableCell>
                          <TableCell>{item.sku}</TableCell>
                          <TableCell>{item.desc}</TableCell>
                          <TableCell>PCS</TableCell>
                          <TableCell className="text-right">100</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div>
                  <Label>Remarks</Label>
                  <Textarea placeholder="Sample remarks" />
                </div>

                <div className="flex justify-between pt-6">
                  <Button className="w-40">Save</Button>
                  <Button variant="secondary" className="w-40">
                    Cancel
                  </Button>
                </div>

              </CardContent>
            </Card>

        </NavigationBar>
      </div>
  )
}

/* ===== FIELD WRAPPER ===== */
function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  )
}


