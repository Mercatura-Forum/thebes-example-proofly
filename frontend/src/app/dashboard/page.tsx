"use client"
import { motion } from "motion/react";
import Link from "next/link";
import BorderLayout from "../../components/layout/borderLayout";
import { Button } from "../../components/ui/button";
import { LoadingSwap } from "../../components/ui/loading-swap";
import CrossSVG from "../../components/svg/CrossSVG";
import { FileCheck, Building2, ShieldCheck } from "lucide-react";
import Image from "next/image";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function Dashboard() {

    return (
        <ProtectedRoute>
        <BorderLayout id="dashboard" className="mt-3 border-t">
                <CrossSVG className="absolute -left-3 -top-3" />
                <CrossSVG className="absolute -right-3 -top-3" />
                
                <div className="seciton-py">
                    {/* Main Content */}
                    <div className="max-w-7xl mx-auto px-4">
                        <motion.div
                            initial={{ opacity: 0, y: "30px" }}
                            animate={{ opacity: 1, y: "0px" }}
                            transition={{ ease: "easeInOut" }}
                            className="flex flex-col gap-6 items-center text-center"
                        >
                            <span className="rounded-full bg-[#f5f5f5] border font-matter text-[12px] py-1 px-[14px] w-fit text-secondary-black">
                                Your dashboard overview
                            </span>
                            
                            <h1 className="text-[40px] md:text-[55px] xl:text-[70px] font-cal text-primary-black leading-none">
                                Welcome Back
                            </h1>
                            
                            <p className="text-gray-700 text-[16px] lg:text-[18px] max-w-2xl">
                                Choose an action to manage your employment verification system
                            </p>

                            {/* Action Cards */}
                            <div className="grid md:grid-cols-3 gap-6 w-full max-w-5xl mt-8">
                                {/* Verify Proof */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                    className="group"
                                >
                                    <Link href="/verify">
                                        <div className="border-2 border-gray-200 rounded-xl p-8 hover:border-gray-400 hover:shadow-lg transition-all duration-300 bg-white flex flex-col items-center gap-4 h-[360px]">
                                            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                                                <ShieldCheck className="w-8 h-8 text-gray-700" />
                                            </div>
                                            <h3 className="font-cal text-2xl text-primary-black h-[64px] flex items-center">
                                                Verify Proof
                                            </h3>
                                            <p className="text-gray-600 text-sm flex-1 flex items-center">
                                                Validate employment proof codes instantly
                                            </p>
                                            <Button className="w-full bg-gray-900 hover:bg-gray-800" asChild>
                                                <LoadingSwap isLoading={false}>
                                                    <span>Verify Now</span>
                                                </LoadingSwap>
                                            </Button>
                                        </div>
                                    </Link>
                                </motion.div>

                                {/* Company Management */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="group"
                                >
                                    <Link href="/company-management">
                                        <div className="border-2 border-gray-200 rounded-xl p-8 hover:border-gray-400 hover:shadow-lg transition-all duration-300 bg-white flex flex-col items-center gap-4 h-[360px]">
                                            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                                                <Building2 className="w-8 h-8 text-gray-700" />
                                            </div>
                                            <h3 className="font-cal text-2xl text-primary-black h-[64px] flex items-center text-center">
                                                Company Management
                                            </h3>
                                            <p className="text-gray-600 text-sm flex-1 flex items-center">
                                                Manage company settings and employees
                                            </p>
                                            <Button className="w-full bg-gray-900 hover:bg-gray-800" asChild>
                                                <LoadingSwap isLoading={false}>
                                                    <span>Manage</span>
                                                </LoadingSwap>
                                            </Button>
                                        </div>
                                    </Link>
                                </motion.div>

                                {/* Generate Proof */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3 }}
                                    className="group"
                                >
                                    <Link href="/generate-proof">
                                        <div className="border-2 border-gray-200 rounded-xl p-8 hover:border-gray-400 hover:shadow-lg transition-all duration-300 bg-white flex flex-col items-center gap-4 h-[360px]">
                                            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                                                <FileCheck className="w-8 h-8 text-gray-700" />
                                            </div>
                                            <h3 className="font-cal text-2xl text-primary-black h-[64px] flex items-center">
                                                Generate Proof
                                            </h3>
                                            <p className="text-gray-600 text-sm flex-1 flex items-center">
                                                Create new employment verification codes
                                            </p>
                                            <Button className="w-full bg-gray-900 hover:bg-gray-800" asChild>
                                                <LoadingSwap isLoading={false}>
                                                    <span>Generate</span>
                                                </LoadingSwap>
                                            </Button>
                                        </div>
                                    </Link>
                                </motion.div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </BorderLayout>
        </ProtectedRoute>
    );
}