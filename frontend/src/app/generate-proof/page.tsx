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
import { BadgeCheck, CheckIcon, ChevronDownIcon, Clock, CopyIcon, ShieldCheck } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useRef, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { toastManager } from '@/components/ui/toast'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { useThebesActor } from '@/hooks/useThebesActor'
import ProtectedRoute from "@/components/ProtectedRoute"


const generateProofCodeSchema = z.object({
    company: z.string().min(1, "Please select a company"),
})
type generateProofCodeFormData = z.infer<typeof generateProofCodeSchema>

export default function page() {
    const [companies, setCompanies] = useState<Array<{username: string, name: string}>>([])
    const [loadingCompanies, setLoadingCompanies] = useState(true)
    const [generatedProof, setGeneratedProof] = useState<string>("")
    const [copied, setCopied] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const [open, setOpen] = useState<boolean>(false)
    const [selectedCompanyUsername, setSelectedCompanyUsername] = useState<string>("")
    const [selectedCompanyName, setSelectedCompanyName] = useState<string>("")
    
    // The Proofly contract on Thebes, bound to the signed-in Memphis session
    const { actor, loading: connecting, error: connectionError } = useThebesActor()
    
    // Load companies when actor is ready
    useEffect(() => {
        const init = async () => {
            if (!actor) return;
            try {
                setLoadingCompanies(true);
                const companyUsernames = await actor.list_my_companies() as string[];
                const companiesWithNames = await Promise.all(
                    companyUsernames.map(async (username) => {
                        try {
                            const nameResult = await actor.get_company_name(username);
                            const name = 'Ok' in nameResult ? nameResult.Ok : username;
                            return { username, name };
                        } catch (error) {
                            return { username, name: username };
                        }
                    })
                );
                setCompanies(companiesWithNames);
            } catch (error) {
                toastManager.add({
                    title: 'Failed to Load Companies',
                    description: error instanceof Error ? error.message : 'Failed to load companies',
                    type: 'error',
                    timeout: 3000,
                });
            } finally {
                setLoadingCompanies(false);
            }
        };
        init();
    }, [actor])

    const form = useForm<generateProofCodeFormData>({
        resolver: zodResolver(generateProofCodeSchema),
        mode: 'all',
        defaultValues: {
            company: ""
        },
    })
    const { isSubmitting } = form.formState

    const handleCopy = () => {
        if (inputRef.current) {
            navigator.clipboard.writeText(inputRef.current.value)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        }
    }

    const onSubmit = async (data: generateProofCodeFormData) => {
        if (!actor) {
            toastManager.add({
                title: "Connection Error",
                description: "Not connected to backend. Please refresh the page.",
                type: "error",
                timeout: 3000,
            });
            return;
        }

        if (!selectedCompanyUsername) {
            toastManager.add({
                title: "No Company Selected",
                description: "Please select a company first.",
                type: "error",
                timeout: 3000,
            });
            return;
        }

        let id: string | undefined;

        try {
            id = toastManager.add({
                title: "Generating proof...",
                type: "loading",
            });

            const result = await actor.generate_proof(selectedCompanyUsername);

            toastManager.close(id);

            // Check if Result is Ok or Err
            if (result && 'Ok' in result) {
                const proofCode = result.Ok;
                setGeneratedProof(proofCode);
                toastManager.add({
                    title: "Proof Generated Successfully",
                    description: "Your proof code has been generated.",
                    type: "success",
                    timeout: 2000,
                });
            } else if (result && 'Err' in result) {
                const errorMsg = result.Err;
                toastManager.add({
                    title: "Generation Failed",
                    description: errorMsg || "Failed to generate proof.",
                    type: "error",
                    timeout: 3000,
                });
            } else {
                toastManager.add({
                    title: "Generation Failed",
                    description: "Unexpected response from backend.",
                    type: "error",
                    timeout: 3000,
                });
            }
        } catch (err: any) {
            if (id) toastManager.close(id);
            toastManager.add({
                title: "Generation Failed",
                description: err.message || "Something went wrong while generating the proof.",
                type: "error",
                timeout: 3000,
            });
        }
    };


    return (
        <ProtectedRoute>
        <BorderLayout id='generate-proof' className='mt-3 border-t'>
            <CrossSVG className="absolute -left-3 -top-3 " />
            <CrossSVG className="absolute -right-3 -top-3" />

            <div className="seciton-py">
                <div className="text-center">
                    <div className='font-matter space-y-4 pb-8 flex flex-col items-center justify-center text-center'>
                        {/* title */}
                        <div className='text-[32px] lg:text-[48px] text-[#141414] font-cal text-balance leading-tight'>
                            <h1>Generate Proof</h1>
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
                                <CardTitle>Generate Proof</CardTitle>
                                <CardDescription>
                                    Select a company you work for to generate your employment proof
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <form id="generateProofCode" onSubmit={form.handleSubmit(onSubmit)}>
                                    <div className='text-start'>
                                        <FieldGroup className='gap-4'>
                                            <Controller
                                                control={form.control}
                                                name="company"
                                                render={({ field, fieldState }) => (
                                                    <Field data-invalid={fieldState.invalid}>
                                                        <div className="flex items-center">
                                                            <FieldLabel htmlFor="company">Select Company  <span className="text-destructive">*</span></FieldLabel>
                                                        </div>
                                                        <Popover open={open} onOpenChange={setOpen}>
                                                            <PopoverTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    role="combobox"
                                                                    aria-expanded={open}
                                                                    className="w-full justify-between border-input bg-background px-3 font-normal outline-offset-0 outline-none hover:bg-background focus-visible:outline-[3px]"
                                                                    disabled={loadingCompanies || connecting}
                                                                >
                                                                    <span className={cn("truncate", !selectedCompanyName && "text-muted-foreground")}>
                                                                        {selectedCompanyName || (loadingCompanies ? "Loading companies..." : "Select company")}
                                                                    </span>
                                                                    <ChevronDownIcon
                                                                        size={16}
                                                                        className="shrink-0 text-muted-foreground/80"
                                                                        aria-hidden="true"
                                                                    />
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent
                                                                className="w-full min-w-[var(--radix-popper-anchor-width)] border-input p-0"
                                                                align="start"
                                                            >
                                                                <Command>
                                                                    <CommandInput placeholder="Search company..." />
                                                                    <CommandList>
                                                                        <CommandEmpty>No company found.</CommandEmpty>
                                                                        <CommandGroup>
                                                                            {companies.map((company) => (
                                                                                <CommandItem
                                                                                    key={company.username}
                                                                                    value={company.name}
                                                                                    onSelect={() => {
                                                                                        setSelectedCompanyUsername(company.username)
                                                                                        setSelectedCompanyName(company.name)
                                                                                        setOpen(false)
                                                                                        form.setValue("company", company.username)
                                                                                      }}
                                                                                >
                                                                                    {company.name}
                                                                                    {selectedCompanyUsername === company.username && (
                                                                                        <CheckIcon size={16} className="ml-auto" />
                                                                                    )}
                                                                                </CommandItem>
                                                                            ))}
                                                                        </CommandGroup>
                                                                    </CommandList>
                                                                </Command>
                                                            </PopoverContent>
                                                        </Popover>
                                                        {fieldState.invalid && (
                                                            <FieldError errors={[fieldState.error]} />
                                                        )}
                                                    </Field>
                                                )}
                                            />
                                            <Field>
                                                <Button form="generateProofCode" type="submit" disabled={isSubmitting || loadingCompanies || connecting} className="w-full">
                                                    <LoadingSwap isLoading={isSubmitting}>Generate Proof</LoadingSwap>
                                                </Button>
                                            </Field>
                                            {generatedProof && (
                                                <div className="*:not-first:mt-2">
                                                    <Label htmlFor="verifiedCode">Your Proof Code</Label>
                                                    <div className="relative">
                                                        <Input
                                                            ref={inputRef}
                                                            id="verifiedCode"
                                                            className="pe-9"
                                                            type="text"
                                                            value={generatedProof}
                                                            readOnly
                                                        />
                                                        <TooltipProvider delayDuration={0}>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <button
                                                                        onClick={handleCopy}
                                                                        className="absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-md text-muted-foreground/80 transition-[color,box-shadow] outline-none hover:text-foreground focus:z-10 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed"
                                                                        aria-label={copied ? "Copied" : "Copy to clipboard"}
                                                                        disabled={copied}
                                                                    >
                                                                        <div
                                                                            className={cn(
                                                                                "transition-all",
                                                                                copied ? "scale-100 opacity-100" : "scale-0 opacity-0"
                                                                            )}
                                                                        >
                                                                            <CheckIcon
                                                                                className="stroke-emerald-500"
                                                                                size={16}
                                                                                aria-hidden="true"
                                                                            />
                                                                        </div>
                                                                        <div
                                                                            className={cn(
                                                                                "absolute transition-all",
                                                                                copied ? "scale-0 opacity-0" : "scale-100 opacity-100"
                                                                            )}
                                                                        >
                                                                            <CopyIcon size={16} aria-hidden="true" />
                                                                        </div>
                                                                    </button>
                                                                </TooltipTrigger>
                                                                <TooltipContent className="px-2 py-1 text-xs">
                                                                    Copy to clipboard
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    </div>
                                                </div>
                                            )
                                            }
                                        </FieldGroup>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    </div>

                </div>
            </div>
        </BorderLayout>
        </ProtectedRoute>
    )
}
