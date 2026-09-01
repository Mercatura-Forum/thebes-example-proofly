"use client"
import BorderLayout from '@/components/layout/borderLayout'
import CrossSVG from '@/components/svg/CrossSVG'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from "@hookform/resolvers/zod"
import z from 'zod'
import { Button } from '@/components/ui/button'
import { LoadingSwap } from '@/components/ui/loading-swap'
import { BadgeCheck, CheckIcon, CircleX, Clock, CopyIcon, ShieldCheck } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { toastManager } from '@/components/ui/toast'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { useThebesActor } from '@/hooks/useThebesActor'
import type { ProofResult, Result } from '@/types/backend'

const MIN_PROOF_CODE_LENGTH = 11

const proofCodeSchema = z.object({
    proofCode: z.string().min(1, "Proof code is required"),
})
type proofCodeFormData = z.infer<typeof proofCodeSchema>

export default function page() {
    const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
    const [proofData, setProofData] = useState<ProofResult | null>(null)
    const [errorMessage, setErrorMessage] = useState<string>("")
    
    // The Proofly contract on Thebes, bound to the signed-in Memphis session
    const { actor, loading: connecting, error: connectionError } = useThebesActor()

    const form = useForm<proofCodeFormData>({
        resolver: zodResolver(proofCodeSchema),
        mode: 'all',
        defaultValues: {
            proofCode: ""
        },
    })
    const { isSubmitting } = form.formState

    const onSubmit = async (data: proofCodeFormData) => {
        
        // Check minimum proof code length
        if (data.proofCode.length < MIN_PROOF_CODE_LENGTH) {
            toastManager.add({
                title: "Proof code is too short",
                description: `Proof code must be at least ${MIN_PROOF_CODE_LENGTH} characters long.`,
                type: "error",
                timeout: 3000,
            })
            return
        }
        
        if (!actor) {
            toastManager.add({
                title: "Connection Error",
                description: "Not connected to backend. Please refresh the page.",
                type: "error",
                timeout: 3000,
            })
            return
        }

        let id: string | undefined
        try {
            id = toastManager.add({
                title: "Verifying proof code...",
                type: "loading",
            })

            // Call backend verify_proof function
            const result: Result<ProofResult> = await actor.verify_proof(data.proofCode)
            
            toastManager.close(id)

            if ('Ok' in result) {
                // Success - proof is valid
                setProofData(result.Ok)
                setStatus("success")
                setErrorMessage("")
                toastManager.add({
                    title: "Proof code verified",
                    description: `Proof code is valid.`,
                    type: "success",
                    timeout: 2000,
                })
            } else {
                // Error - proof is invalid
                setStatus("error")
                setErrorMessage(result.Err)
                setProofData(null)
                toastManager.add({
                    title: "Verification Failed",
                    description: result.Err,
                    type: "error",
                    timeout: 3000,
                })
            }
        } catch (err: any) {
            if (id) toastManager.close(id)
            setStatus("error")
            const errorMsg = err.message || "Something went wrong while verifying the code."
            setErrorMessage(errorMsg)
            setProofData(null)
            toastManager.add({
                title: "Verification failed",
                description: errorMsg,
                type: "error",
                timeout: 3000,
            })
        }
    }


    // Show connecting state
    if (connecting) {
        return (
            <BorderLayout id='verify-page' className='mt-3 border-t'>
                <div className="seciton-py flex items-center justify-center min-h-[50vh]">
                    <div className="text-center">
                        <div className="animate-spin w-12 h-12 border-4 border-gray-300 border-t-gray-900 rounded-full mx-auto mb-4"></div>
                        <p className="text-gray-600">Connecting to backend...</p>
                    </div>
                </div>
            </BorderLayout>
        )
    }

    // Show connection error state
    if (connectionError) {
        return (
            <BorderLayout id='verify-page' className='mt-3 border-t'>
                <div className="seciton-py flex items-center justify-center min-h-[50vh]">
                    <Card className="max-w-md">
                        <CardContent>
                            <div className="text-center">
                                <CircleX className="w-12 h-12 text-red-500 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">Connection Error</h3>
                                <p className="text-gray-600 mb-4">{connectionError}</p>
                                <Button onClick={() => window.location.reload()}>
                                    Retry Connection
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </BorderLayout>
        )
    }

    return (
        <BorderLayout id='verify-page' className='mt-3 border-t'>
            <CrossSVG className="absolute -left-3 -top-3 " />
            <CrossSVG className="absolute -right-3 -top-3" />

            <div className="seciton-py">
                <div className="text-center">
                    <div className='font-matter space-y-4 pb-8 flex flex-col items-center justify-center text-center'>
                        {/* title */}
                        <div className='text-[32px] lg:text-[48px] text-[#141414] font-cal text-balance leading-tight'>
                            <h1>Verify Employment Proof</h1>
                        </div>
                        {/* description */}
                        <div className='text-base lg:text-lg text-gray-700 max-w-2xl'>
                            <h2>
                                Enter a proof code to verify employment status instantly
                            </h2>
                        </div>
                    </div>

                    <div className="w-full flex justify-center flex-col items-center gap-6">
                        <Card className="w-full max-w-xl shadow-md">
                            <CardHeader className='text-start'>
                                <CardTitle>Enter Proof Code</CardTitle>
                                <CardDescription>
                                    Proof codes are unique alphanumeric codes generated for each employee
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form id="proofCode" onSubmit={form.handleSubmit(onSubmit)}>
                                    <div className='text-start'>
                                        <FieldGroup className='gap-4'>
                                            <Controller
                                                control={form.control}
                                                name="proofCode"
                                                render={({ field, fieldState }) => (
                                                    <Field data-invalid={fieldState.invalid}>
                                                        <div className="flex items-center">
                                                            <FieldLabel htmlFor="proofCode">Proof Code  <span className="text-destructive">*</span></FieldLabel>
                                                        </div>
                                                        <Input
                                                            {...field}
                                                            aria-invalid={fieldState.invalid}
                                                            id="proofCode"
                                                            // type=""
                                                            // autoComplete=""
                                                            placeholder="enter the proof code"
                                                            spellCheck="false"
                                                        />
                                                        {fieldState.invalid && (
                                                            <FieldError errors={[fieldState.error]} />
                                                        )}
                                                    </Field>
                                                )}
                                            />
                                            <Field>
                                                <Button form="proofCode" type="submit" disabled={isSubmitting} className="w-full">
                                                    <LoadingSwap isLoading={isSubmitting}>Verify Proof Code</LoadingSwap>
                                                </Button>
                                            </Field>
                                            {status === "success" && proofData && (

                                                <Card className='w-full bg-[#F4F4F4] rounded-md shadow border border-gray relative '>
                                                    <span className="absolute size-1.5 bg-[#C8D4DD] rounded-full left-[7px] top-[7px]" />
                                                    <span className="absolute size-1.5 bg-[#C8D4DD] rounded-full right-[7px] top-[7px]" />
                                                    <span className="absolute size-1.5 bg-[#C8D4DD] rounded-full left-[7px] bottom-[7px]" />
                                                    <span className="absolute size-1.5 bg-[#C8D4DD] rounded-full right-[7px] bottom-[7px]" />

                                                    <CardContent>
                                                        <div className='flex items-center justify-between flex-wrap gap-3'>
                                                            {/* user */}
                                                            <div className="flex items-center gap-3 flex-wrap">
                                                                <Avatar className='size-10 shrink-0'>
                                                                    <AvatarFallback>{proofData.employee_name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                                </Avatar>
                                                                <div>
                                                                    <h6 className="text-lg font-semibold text-gray-900 font-matter leading-none">{proofData.employee_name}</h6>
                                                                    <p className="text-sm text-gray-600 leading-none">{proofData.position}</p>
                                                                </div>
                                                            </div>
                                                            {/* company */}
                                                            <div className='flex items-center flex-wrap gap-1'>
                                                                <Badge
                                                                    variant="secondary"
                                                                >
                                                                    {proofData.company_name}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                        <div className="mt-4 text-sm text-gray-600">
                                                            <p>Created: {new Date(Number(proofData.created_at / BigInt(1_000_000))).toLocaleString()}</p>
                                                        </div>

                                                    </CardContent>
                                                </Card>

                                            )}
                                            {status === "error" && (

                                                <Card className='w-full bg-[#F4F4F4] rounded-md shadow border border-gray relative '>
                                                    <span className="absolute size-1.5 bg-[#C8D4DD] rounded-full left-[7px] top-[7px]" />
                                                    <span className="absolute size-1.5 bg-[#C8D4DD] rounded-full right-[7px] top-[7px]" />
                                                    <span className="absolute size-1.5 bg-[#C8D4DD] rounded-full left-[7px] bottom-[7px]" />
                                                    <span className="absolute size-1.5 bg-[#C8D4DD] rounded-full right-[7px] bottom-[7px]" />

                                                    <CardContent>
                                                        <Empty className='p-1 gap-2'>
                                                            <EmptyHeader>
                                                                <EmptyMedia className='mb-1' variant="icon">
                                                                    <CircleX className='text-destructive' />
                                                                </EmptyMedia>
                                                                <EmptyTitle className='text-lg text-gray-900 font-matter leading-none'>Verification Failed</EmptyTitle>
                                                            </EmptyHeader>
                                                            <EmptyContent>
                                                                <EmptyDescription className='text-sm text-gray-600'>
                                                                    {errorMessage || "Invalid proof code"}
                                                                </EmptyDescription>
                                                            </EmptyContent>
                                                        </Empty>
                                                    </CardContent>
                                                </Card>
                                            )}
                                        </FieldGroup>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>

                        <Card className="w-full max-w-xl shadow-md text-start">
                            <CardContent className="space-y-4">
                                <h5 className="text-lg font-semibold text-gray-900">
                                    How Verification Works
                                </h5>

                                <div className="space-y-3">
                                    {/* Step 1 */}
                                    <div className="flex items-start gap-2">
                                        <div className="shrink-0 pt-1">
                                            <ShieldCheck className="size-4 text-gray-700" />
                                        </div>
                                        <p className="text-sm text-gray-700 leading-relaxed">
                                            Proof codes are generated by verified employees and stored securely
                                            on the Thebes blockchain.
                                        </p>
                                    </div>

                                    {/* Step 2 */}
                                    <div className="flex items-start gap-2">
                                        <div className="shrink-0 pt-1">
                                            <Clock className="size-4 text-gray-700" />
                                        </div>
                                        <p className="text-sm text-gray-700 leading-relaxed">
                                            Each proof code is valid for 1 hour from the time of generation.
                                        </p>
                                    </div>

                                    {/* Step 3 */}
                                    <div className="flex items-start gap-2">
                                        <div className="shrink-0 pt-1">
                                            <BadgeCheck className="size-4 text-gray-700" />
                                        </div>
                                        <p className="text-sm text-gray-700 leading-relaxed">
                                            Verification is instant and does not require authentication.
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                </div>
            </div>
        </BorderLayout>
    )
}
