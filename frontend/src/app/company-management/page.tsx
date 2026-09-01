"use client"

import BorderLayout from "@/components/layout/borderLayout"
import CrossSVG from "@/components/svg/CrossSVG"
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Building2, Eye, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useThebesActor } from '@/hooks/useThebesActor'
import type { Company } from '@/types/backend'
import ProtectedRoute from "@/components/ProtectedRoute"


export default function page() {
    // Mounted gate to prevent hydration mismatch
    const [mounted, setMounted] = useState(false);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loadingCompanies, setLoadingCompanies] = useState(true);
    
    // The Proofly contract on Thebes, bound to the signed-in Memphis session
    const { actor, loading: connecting, error: connectionError } = useThebesActor();

    // Helper function to load companies from backend
    const loadCompaniesFromBackend = async () => {
        if (!actor) return;
        
        try {
            setLoadingCompanies(true);
            
            // Load companies from backend (returns array of usernames)
            const companyUsernames = await actor.list_my_admin_companies() as string[];
            
            // Fetch company names and employee counts for each username
            const companiesData: Company[] = await Promise.all(
                companyUsernames.map(async (username, index) => {
                    try {
                        // Get company name from backend
                        const nameResult = await actor.get_company_name(username);
                        const companyName = 'Ok' in nameResult ? nameResult.Ok : username;
                        
                        // Get employees list to count them
                        let employeesCount = 0;
                        try {
                            const employeesResult = await actor.list_company_employess(username);
                            if ('Ok' in employeesResult) {
                                employeesCount = employeesResult.Ok.length;
                            }
                        } catch (error) {
                            // If fetching employees fails, count stays 0
                            console.error(`Failed to fetch employees for ${username}:`, error);
                        }
                        
                        return {
                            id: index + 1,
                            username: username,
                            name: companyName,
                            image: "",
                            employees: Array(employeesCount).fill(null) // Array with length = employeesCount
                        };
                    } catch (error) {
                        // Fallback to username if get_company_name fails
                        return {
                            id: index + 1,
                            username: username,
                            name: username,
                            image: "",
                            employees: []
                        };
                    }
                })
            );
            
            setCompanies(companiesData);
        } catch (error) {
            console.error("Failed to load companies:", error);
        } finally {
            setLoadingCompanies(false);
        }
    };

    // Load companies when actor is ready
    useEffect(() => {
        const init = async () => {
            await loadCompaniesFromBackend();
            setMounted(true);
        };
        init();
    }, [actor]);


    // Add Dialog state
    const [openAdd, setOpenAdd] = useState(false);
    const [addForm, setAddForm] = useState({ username: "", name: "" });
    const [savingAdd, setSavingAdd] = useState(false);
    const [usernameError, setUsernameError] = useState("");

    // Edit Dialog state
    const [openEdit, setOpenEdit] = useState(false);
    const [editingCompany, setEditingCompany] = useState<Company | null>(null);
    const [editForm, setEditForm] = useState({ name: "" });
    const [savingEdit, setSavingEdit] = useState(false);

    const openAddDialog = () => {
        setAddForm({ username: "", name: "" });
        setUsernameError("");
        setOpenAdd(true);
    };

    const validateUsername = (username: string): boolean => {
        // Check if username contains only lowercase letters, numbers, hyphens, and underscores
        const validPattern = /^[a-z0-9_-]*$/;
        return validPattern.test(username);
    };

    const openEditDialog = (c: Company) => {
        setEditingCompany(c);
        setEditForm({ name: c.name });
        setOpenEdit(true);
    };

    const closeAddDialog = () => {
        setOpenAdd(false);
        setAddForm({ username: "", name: "" });
        setUsernameError("");
    };

    const closeEditDialog = () => {
        setOpenEdit(false);
        setEditingCompany(null);
        setEditForm({ name: "" });
    };

    const handleAddCompany = async () => {
        if (!addForm.name.trim() || !addForm.username.trim()) {
            alert("Please fill in all fields");
            return;
        }

        if (!validateUsername(addForm.username)) {
            setUsernameError("Username can only contain lowercase letters, numbers, hyphens (-), and underscores (_). No spaces or special characters allowed.");
            return;
        }

        if (!actor) {
            alert("Not connected to backend");
            return;
        }

        setSavingAdd(true);
        try {
            const result = await actor.add_new_companey(addForm.username.trim(), addForm.name.trim());
            
            if ('Ok' in result) {
                alert("Company added successfully!");
                
                // Reload companies from backend
                await loadCompaniesFromBackend();
                closeAddDialog();
            } else {
                alert("Error: " + result.Err);
            }
        } catch (error) {
            alert("Failed to add company: " + (error instanceof Error ? error.message : "Unknown error"));
        } finally {
            setSavingAdd(false);
        }
    };

    const handleEditCompany = async () => {
        if (!editingCompany) return;

        // Validate name
        if (!editForm.name.trim()) {
            alert("Please enter company name");
            return;
        }

        if (!actor) {
            alert("Not connected to backend");
            return;
        }

        setSavingEdit(true);
        try {
            // Call backend to edit company name
            const result = await actor.edit_company(editingCompany.username, editForm.name.trim());
            
            if ('Ok' in result) {
                alert("Company updated successfully!");
                
                // Update local state
                setCompanies((prev) =>
                    prev.map((c) =>
                        c.username === editingCompany.username 
                            ? { ...c, name: editForm.name.trim() } 
                            : c
                    )
                );
                closeEditDialog();
            } else {
                alert("Error: " + result.Err);
            }
        } catch (error) {
            alert("Failed to update company: " + (error instanceof Error ? error.message : "Unknown error"));
        } finally {
            setSavingEdit(false);
        }
    };

    const handleDeleteCompany = async (company: Company) => {
        if (!confirm(`Are you sure you want to delete "${company.name}"? This action cannot be undone.`)) return;

        if (!actor) {
            alert("Not connected to backend");
            return;
        }

        try {
            // Call backend to delete company
            const result = await actor.delete_company(company.username);
            
            if ('Ok' in result) {
                alert("Company deleted successfully!");
                
                // Reload companies from backend to ensure consistency
                await loadCompaniesFromBackend();
            } else {
                alert("Error: " + result.Err);
            }
        } catch (error) {
            alert("Failed to delete company: " + (error instanceof Error ? error.message : "Unknown error"));
        }
    };

    // Skeleton while mounting to avoid hydration mismatch
    if (!mounted) {
        return (
            <ProtectedRoute>
            <BorderLayout id="verify-page" className="mt-3 border-t">
                <CrossSVG className="absolute -left-3 -top-3 " />
                <CrossSVG className="absolute -right-3 -top-3" />
                <div className="seciton-py">
                    <div className="text-center">
                        <div className="font-matter space-y-4 pb-8 flex flex-col items-center justify-center text-center">
                            {/* Label */}
                            <div className="text-xs text-secondary-black flex gap-1.5 px-3.5 py-1 bg-white items-center shadow border border-gray rounded-full w-fit [&>svg]:size-4">
                                Your companies in one place
                            </div>

                            {/* Title */}
                            <div className="text-[32px] lg:text-[48px] text-[#141414] font-cal capitalize text-balance leading-tight">
                                <h1>Company Management</h1>
                            </div>

                            {/* Description */}
                            <div className="text-base lg:text-lg text-gray-700 max-w-2xl">
                                <h2>
                                    Manage your companies with ease — add new companies, edit or remove employees,
                                    and maintain full control as the company owner.
                                </h2>
                            </div>
                        </div>



                        {/* Company Cards */}
                        <div className="flex justify-center items-center">
                            <Spinner />
                        </div>
                    </div>
                </div>
            </BorderLayout>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute>
        <BorderLayout id="verify-page" className="mt-3 border-t">
            <CrossSVG className="absolute -left-3 -top-3 " />
            <CrossSVG className="absolute -right-3 -top-3" />

            <div className="seciton-py">
                <div className="text-center">
                    <div className="font-matter space-y-4 pb-8 flex flex-col items-center justify-center text-center">
                        {/* Label */}
                        <div className="text-xs text-secondary-black flex gap-1.5 px-3.5 py-1 bg-white items-center shadow border border-gray rounded-full w-fit [&>svg]:size-4">
                            Your companies in one place
                        </div>

                        {/* Title */}
                        <div className="text-[32px] lg:text-[48px] text-[#141414] font-cal capitalize text-balance leading-tight">
                            <h1>Company Management</h1>
                        </div>

                        {/* Description */}
                        <div className="text-base lg:text-lg text-gray-700 max-w-2xl">
                            <h2>
                                Manage your companies with ease — add new companies, edit or remove employees,
                                and maintain full control as the company owner.
                            </h2>
                        </div>
                    </div>

                    {/* Add Company Button */}
                    <div className="flex justify-center mb-8">
                        <Dialog open={openAdd} onOpenChange={setOpenAdd}>
                            <DialogTrigger asChild>
                                <Button className="gap-2" onClick={openAddDialog}>
                                    <Plus className="size-4" /> Add Company
                                </Button>
                            </DialogTrigger>

                            <DialogContent className="sm:max-w-[400px]">
                                <DialogHeader>
                                    <DialogTitle>Add New Company</DialogTitle>
                                </DialogHeader>

                                <div className="space-y-3">
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">Company Name</label>
                                        <Input
                                            placeholder="Enter company name"
                                            value={addForm.name}
                                            onChange={(e) => setAddForm((s) => ({ ...s, name: e.target.value }))}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium mb-1 block">Company Username</label>
                                        <Input
                                            placeholder="Enter company username"
                                            value={addForm.username}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setAddForm((s) => ({ ...s, username: value }));
                                                
                                                // Validate and show error if invalid
                                                if (value && !validateUsername(value)) {
                                                    setUsernameError("Only lowercase letters, numbers, hyphens (-), and underscores (_) are allowed");
                                                } else {
                                                    setUsernameError("");
                                                }
                                            }}
                                            className={usernameError ? "border-red-500" : ""}
                                        />
                                        {usernameError && (
                                            <p className="text-xs text-red-500 mt-1">{usernameError}</p>
                                        )}
                                    </div>
                                    <Button 
                                        type="submit" 
                                        onClick={handleAddCompany} 
                                        className="w-full"
                                        disabled={savingAdd}
                                    >
                                        {savingAdd ? "Adding..." : "Add Company"}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    {/* Company Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative">
                        {companies.map((item, i) => (
                            <div
                                key={item.id}
                                className="font-matter overflow-hidden bg-white border border-gray rounded-2xl relative"
                            >
                                {/* border dots */}
                                <span className="absolute size-1.5 bg-[#C8D4DD] rounded-full left-3.5 top-3.5" />
                                <span className="absolute size-1.5 bg-[#C8D4DD] rounded-full right-3.5 top-3.5" />
                                <span className="absolute size-1.5 bg-[#C8D4DD] rounded-full left-3.5 bottom-3.5" />
                                <span className="absolute size-1.5 bg-[#C8D4DD] rounded-full right-3.5 bottom-3.5" />

                                <div className="p-10  flex flex-col items-center text-center">
                                    {/* ✅ Image or Default Icon */}
                                    {item.image ? (
                                        <img
                                            src={item.image}
                                            alt={item.name}
                                            className="size-12 object-cover rounded-md mb-3"
                                        />
                                    ) : (
                                        <div className="inline-block p-2 font-mono text-[#6b7280] mb-3 text-sm rounded-md bg-[#e5e7eb] font-bold">
                                            <Building2 className="text-gray-500 size-8" />
                                        </div>
                                    )}
                                    <div className="mb-[6px] text-[18px] text-[#141414] font-semibold">
                                        {item.name}
                                    </div>
                                    <p className="text-sm text-gray-500 mb-3">{item.employees.length} Employees</p>

                                    {/* Actions */}
                                    <div className="flex gap-2 justify-center flex-wrap">
                                        <Button variant="secondary" className="gap-1" onClick={() => openEditDialog(item)}>
                                            <Pencil className="size-4" /> Edit
                                        </Button>
                                        <Link href={`/companies?username=${item.username}`}>
                                            <Button variant="default" className="gap-1">
                                                <Eye className="size-4" /> View
                                            </Button>
                                        </Link>
                                        <Button
                                            variant="destructive"
                                            className="gap-1"
                                            onClick={() => handleDeleteCompany(item)}
                                        >
                                            <Trash2 className="size-4" /> Delete
                                        </Button>
                                    </div>

                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Edit Company Dialog */}
            <Dialog open={openEdit} onOpenChange={setOpenEdit}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>Edit Company Name</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Show current username (read-only) */}
                        {editingCompany && (
                            <div>
                                <label className="text-sm font-medium mb-1 block text-gray-600">Company Username</label>
                                <div className="px-3 py-2 bg-gray-100 rounded-md text-sm text-gray-700 border border-gray-200">
                                    {editingCompany.username}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">Username cannot be changed</p>
                            </div>
                        )}

                        {/* Edit Name Field */}
                        <div>
                            <label className="text-sm font-medium mb-1 block">Company Name</label>
                            <Input
                                placeholder="Enter company name"
                                value={editForm.name}
                                onChange={(e) => setEditForm({ name: e.target.value })}
                            />
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-2">
                            <Button 
                                type="button"
                                variant="outline"
                                onClick={closeEditDialog}
                                className="flex-1"
                                disabled={savingEdit}
                            >
                                Cancel
                            </Button>
                            <Button 
                                type="submit" 
                                onClick={handleEditCompany} 
                                className="flex-1"
                                disabled={savingEdit}
                            >
                                {savingEdit ? "Saving..." : "Save Changes"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </BorderLayout>
        </ProtectedRoute>
    )

}
