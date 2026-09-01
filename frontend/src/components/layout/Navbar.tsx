"use client"
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Building2, FileCheck, ShieldCheck, LogOut, User, Home, Menu, X, CopyIcon, CheckIcon, Pencil, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { useThebesActor } from "@/hooks/useThebesActor";
import { useAuth } from "@/contexts/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { asset } from "@/lib/asset";

const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: Home },
    { href: "/verify", label: "Verify", icon: ShieldCheck },
    { href: "/company-management", label: "Companies", icon: Building2 },
    { href: "/generate-proof", label: "Generate", icon: FileCheck },
];

export default function Navbar() {
    const pathname = usePathname();
    const router = useRouter();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [accountName, setAccountName] = useState<string>("Account");
    const [copied, setCopied] = useState(false);
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editName, setEditName] = useState<string>("");
    const [savingName, setSavingName] = useState(false);
    const [principal, setPrincipal] = useState<string>("");
    const { actor, loading: connecting } = useThebesActor();
    const { isAuthenticated, logout: authLogout } = useAuth();

    // Fetch principal from backend using actor
    const fetchPrincipal = async () => {
        if (!actor || connecting) {
            return;
        }

        try {
            const principalId = await actor.get_principal();
            console.log("Principal from backend:", principalId);
            setPrincipal(principalId || "");
        } catch (error) {
            console.error("Failed to fetch principal:", error);
            setPrincipal("");
        }
    };

    // Fetch account name from backend using actor
    const fetchAccountName = async () => {
        if (!actor || connecting) {
            return;
        }

        try {
            // Fetch account name
            const result = await actor.get_my_name();
            console.log("Result:", result);
            if (result && typeof result === 'object' && 'Ok' in result) {
                const name = result.Ok as string;
                setAccountName(name || "Set your name");
                setEditName(name || "");
            } else if (result && typeof result === 'object' && 'Err' in result) {
                console.log("Account name error:", result.Err);
                // If name not set or error, show placeholder
                setAccountName("Set your name");
                setEditName("");
            }
        } catch (error) {
            console.error("Failed to fetch account name:", error);
            setAccountName("Set your name");
            setEditName("");
        }
    };

    useEffect(() => {
        fetchPrincipal();
        fetchAccountName();
    }, [actor, connecting]);

    // Refetch name and principal when popover opens
    useEffect(() => {
        if (isPopoverOpen && actor && !connecting) {
            fetchPrincipal();
            fetchAccountName();
        }
    }, [isPopoverOpen, actor, connecting]);

    // Note: Principal is now fetched from backend using get_principal()

    // Handle copy principal
    const handleCopyPrincipal = async () => {
        if (!principal) return;
        
        try {
            await navigator.clipboard.writeText(principal);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error("Failed to copy principal:", error);
        }
    };

    // Handle save name
    const handleSaveName = async () => {
        if (!actor || !editName.trim()) {
            setIsEditingName(false);
            return;
        }

        setSavingName(true);
        try {
            const result = await actor.set_full_name(editName.trim());
            if (result && typeof result === 'object' && 'Ok' in result) {
                setAccountName(editName.trim());
                setIsEditingName(false);
                // Refetch to make sure it's saved
                await fetchAccountName();
            } else if (result && typeof result === 'object' && 'Err' in result) {
                alert("Error: " + result.Err);
            }
        } catch (error) {
            console.error("Failed to save name:", error);
            alert("Failed to save name. Please try again.");
        } finally {
            setSavingName(false);
        }
    };

    // Handle edit name click
    const handleEditNameClick = () => {
        setEditName(accountName === "Set your name" ? "" : accountName);
        setIsEditingName(true);
    };

    // Handle cancel edit
    const handleCancelEdit = () => {
        setEditName(accountName === "Set your name" ? "" : accountName);
        setIsEditingName(false);
    };

    return (
        <nav className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm">
            <div className="max-w-7xl mx-auto px-6">
                <div className="flex items-center justify-between h-16">
                    {/* Logo & Brand */}
                    <Link href="/" className="flex items-center gap-3 group">
                        <Image 
                            src={asset("/images/proofly-logo.png")} 
                            alt="Proofly Logo" 
                            width={40} 
                            height={40}
                            className="w-10 h-10 transition-transform group-hover:scale-105"
                        />
                        <div className="flex flex-col">
                            <span className="font-cal text-xl text-gray-900 leading-none">Proofly</span>
                            <span className="font-matter text-xs text-gray-500 leading-none">Verification System</span>
                        </div>
                    </Link>

                    {/* Desktop Navigation Links */}
                    <div className="hidden md:flex items-center gap-1">
                        {navLinks.map((link) => {
                            const Icon = link.icon;
                            const isActive = pathname === link.href;
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={cn(
                                        "flex items-center gap-2 px-4 py-2 rounded-lg font-matter text-sm transition-all duration-200",
                                        isActive
                                            ? "bg-gray-900 text-white shadow-md"
                                            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                                    )}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span>{link.label}</span>
                                </Link>
                            );
                        })}
                    </div>

                    {/* Right side - Profile & Logout */}
                    <div className="flex items-center gap-3">
                        {/* Profile Button with Popover - Hidden on mobile and when not authenticated */}
                        {isAuthenticated && (
                        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                            <PopoverTrigger asChild>
                                <button className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-all duration-200 group">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                                        <User className="w-4 h-4 text-white" />
                                    </div>
                                    <span className="hidden lg:block font-matter text-sm text-gray-700 font-medium">{accountName}</span>
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-4" align="end">
                                <div className="space-y-4">
                                    {/* Name Section */}
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs font-medium text-gray-500">Account Name</p>
                                            {!isEditingName && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 px-2"
                                                    onClick={handleEditNameClick}
                                                >
                                                    <Pencil className="w-3 h-3" />
                                                </Button>
                                            )}
                                        </div>
                                        {isEditingName ? (
                                            <div className="space-y-2">
                                                <Input
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    placeholder="Enter your name"
                                                    className="text-sm"
                                                    disabled={savingName}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !savingName) {
                                                            handleSaveName();
                                                        } else if (e.key === 'Escape') {
                                                            handleCancelEdit();
                                                        }
                                                    }}
                                                    autoFocus
                                                />
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        onClick={handleSaveName}
                                                        disabled={savingName || !editName.trim()}
                                                        className="flex-1"
                                                    >
                                                        <Save className="w-3 h-3 mr-1" />
                                                        {savingName ? "Saving..." : "Save"}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={handleCancelEdit}
                                                        disabled={savingName}
                                                    >
                                                        Cancel
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="px-3 py-2 bg-gray-50 rounded border text-sm text-gray-900 min-h-[2.5rem] flex items-center">
                                                {accountName}
                                            </div>
                                        )}
                                    </div>

                                    {/* Principal ID Section */}
                                    <div>
                                        <p className="text-xs font-medium text-gray-500 mb-1">Principal ID</p>
                                        <div className="flex items-center gap-2">
                                            <code className="flex-1 text-xs font-mono bg-gray-50 px-2 py-1.5 rounded border break-all min-h-[2.5rem] flex items-center">
                                                {connecting && !principal ? "Loading..." : principal || "Not available"}
                                            </code>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={handleCopyPrincipal}
                                                className="shrink-0"
                                                disabled={!principal || copied || connecting}
                                                title={copied ? "Copied!" : "Copy to clipboard"}
                                            >
                                                {copied ? (
                                                    <CheckIcon className="w-4 h-4 text-green-600" />
                                                ) : (
                                                    <CopyIcon className="w-4 h-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                        )}
                        
                        {/* Logout Button - Hidden on mobile and when not authenticated */}
                        {isAuthenticated && (
                        <Button 
                            variant="outline" 
                            size="sm"
                            className="hidden sm:flex gap-2 font-matter !bg-white !text-gray-700 border-2 border-gray-300 hover:!bg-red-600 hover:!text-white hover:!border-red-600 transition-all duration-200 active:scale-95"
                            onClick={async () => {
                                await authLogout();
                                router.push('/');
                            }}
                        >
                            <LogOut className="w-4 h-4" />
                            <span>Logout</span>
                        </Button>
                        )}

                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
                            aria-label="Toggle menu"
                        >
                            {isMobileMenuOpen ? (
                                <X className="w-6 h-6 text-gray-700" />
                            ) : (
                                <Menu className="w-6 h-6 text-gray-700" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <div className="md:hidden py-4 border-t">
                        <div className="flex flex-col gap-2">
                            {navLinks.map((link) => {
                                const Icon = link.icon;
                                const isActive = pathname === link.href;
                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        onClick={() => setIsMobileMenuOpen(false)}
                                        className={cn(
                                            "flex items-center gap-3 px-4 py-3 rounded-lg font-matter text-sm transition-all duration-200",
                                            isActive
                                                ? "bg-gray-900 text-white shadow-md"
                                                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                                        )}
                                    >
                                        <Icon className="w-5 h-5" />
                                        <span>{link.label}</span>
                                    </Link>
                                );
                            })}
                            
                            {/* Mobile Profile & Logout - Only show when authenticated */}
                            {isAuthenticated && (
                            <div className="flex flex-col gap-2 mt-2 pt-4 border-t">
                                <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <button className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-gray-100 transition-all duration-200 text-gray-600">
                                            <User className="w-5 h-5" />
                                            <span className="font-matter text-sm">{accountName}</span>
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[calc(100vw-3rem)] p-4" align="start">
                                        <div className="space-y-4">
                                            {/* Name Section */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <p className="text-xs font-medium text-gray-500">Account Name</p>
                                                    {!isEditingName && (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-6 px-2"
                                                            onClick={handleEditNameClick}
                                                        >
                                                            <Pencil className="w-3 h-3" />
                                                        </Button>
                                                    )}
                                                </div>
                                                {isEditingName ? (
                                                    <div className="space-y-2">
                                                        <Input
                                                            value={editName}
                                                            onChange={(e) => setEditName(e.target.value)}
                                                            placeholder="Enter your name"
                                                            className="text-sm"
                                                            disabled={savingName}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' && !savingName) {
                                                                    handleSaveName();
                                                                } else if (e.key === 'Escape') {
                                                                    handleCancelEdit();
                                                                }
                                                            }}
                                                            autoFocus
                                                        />
                                                        <div className="flex gap-2">
                                                            <Button
                                                                size="sm"
                                                                onClick={handleSaveName}
                                                                disabled={savingName || !editName.trim()}
                                                                className="flex-1"
                                                            >
                                                                <Save className="w-3 h-3 mr-1" />
                                                                {savingName ? "Saving..." : "Save"}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={handleCancelEdit}
                                                                disabled={savingName}
                                                            >
                                                                Cancel
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="px-3 py-2 bg-gray-50 rounded border text-sm text-gray-900 min-h-[2.5rem] flex items-center">
                                                        {accountName}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Principal ID Section */}
                                            <div>
                                                <p className="text-xs font-medium text-gray-500 mb-1">Principal ID</p>
                                                <div className="flex items-center gap-2">
                                                    <code className="flex-1 text-xs font-mono bg-gray-50 px-2 py-1.5 rounded border break-all min-h-[2.5rem] flex items-center">
                                                        {connecting && !principal ? "Loading..." : principal || "Not available"}
                                                    </code>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={handleCopyPrincipal}
                                                        className="shrink-0"
                                                        disabled={!principal || copied || connecting}
                                                        title={copied ? "Copied!" : "Copy to clipboard"}
                                                    >
                                                        {copied ? (
                                                            <CheckIcon className="w-4 h-4 text-green-600" />
                                                        ) : (
                                                            <CopyIcon className="w-4 h-4" />
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                <button 
                                    className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-red-50 transition-all duration-200 text-red-600"
                                    onClick={async () => {
                                        await authLogout();
                                        router.push('/');
                                        setIsMobileMenuOpen(false);
                                    }}
                                >
                                    <LogOut className="w-5 h-5" />
                                    <span className="font-matter text-sm">Logout</span>
                                </button>
                            </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </nav>
    );
}
