"use client"
import { motion } from "motion/react";
import Image from "next/image";
import BorderLayout from "../layout/borderLayout";
import { Button } from "../ui/button";
import { LoadingSwap } from "../ui/loading-swap";
import Link from "next/link";
import CrossSVG from "../svg/CrossSVG";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { asset } from "@/lib/asset";
import { useState } from "react";

export default function Hero() {
    const router = useRouter();
    const { isAuthenticated, login, isLoading } = useAuth();
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const handleGoToDashboard = async () => {
        if (!isAuthenticated) {
            setIsLoggingIn(true);
            try {
                await login();
                // Redirect will happen automatically in AuthContext after successful login
                // Note: setIsLoggingIn(false) not needed here as redirect will happen
            } catch (error) {
                console.error("Login failed:", error);
            } finally {
                // Reset loading state if login failed or was cancelled
                setTimeout(() => setIsLoggingIn(false), 100);
            }
        } else {
            router.push("/dashboard");
        }
    };

    return (
        <BorderLayout id="hero" className="mt-3 border-t">
            <CrossSVG className="absolute -left-3 -top-3 " />
            <CrossSVG className="absolute -right-3 -top-3" />
            <div className="shadow-md px-2 lg:p-20 lg:pb-10 grid max-lg:grid-rows-[auto_1fr] gap-4 lg:grid-cols-2 lg:gap-10 bg-white rounded-xl border border-gray font-matter overflow-hidden relative pb-2">
                <motion.div
                    initial={{ opacity: 0, y: "30px" }}
                    animate={{ opacity: 1, y: "0px" }}
                    transition={{ ease: "easeInOut" }}
                    className="relative z-10 max-lg:p-4 max-lg:pt-[64px] flex flex-col gap-4 lg:gap-7 max-lg:items-center max-lg:text-center"
                >
                    <span className="rounded-full bg-[#f5f5f5] border font-matter text-[12px] py-1 px-[14px] w-fit text-secondary-black max-lg:mx-auto">
                        The genration of Employee Verification
                    </span>
                    <h1 className=" text-[40px] md:text-[55px] xl:text-[70px] font-cal text-primary-black leading-none text-balance">
                        Decentralized Employee Verification
                    </h1>
                    <p className="text-gray-700 text-[16px] lg:text-[18px] max-w-md lg:max-w-2xl text-pretty">
                        Secure, transparent, and instant employment verification powered by the Thebes Protocol. Generate verifiable proof codes and validate employment status in seconds.
                    </p>
                    <div className="w-[90%] space-y-4 md:max-w-[600px] max-w-[400px] lg:max-w-[400px] max-lg:mx-auto max-lg:px-2">
                        <div className="flex gap-4 md:flex-row flex-col lg:flex-col">
                            <Button
                                className="w-full"
                                onClick={handleGoToDashboard}
                                disabled={isLoading || isLoggingIn}
                            >
                                <LoadingSwap isLoading={isLoading || isLoggingIn}>
                                    <span>{isAuthenticated ? "Go to Dashboard" : "Sign in with a passkey"}</span>
                                </LoadingSwap>
                            </Button>
                            <Button asChild
                                className="w-full"
                                variant="outline"
                            >
                                <LoadingSwap isLoading={false}>
                                    <Link href="/verify">Verify Proof Code</Link>
                                </LoadingSwap>
                            </Button>
                        </div>
                    </div>
                </motion.div>
                <div className="relative z-30">
                    <div className="hidden lg:flex items-center flex-nowrap gap-12 mt-8 mx-2">
                        <Image fill className="rounded-2xl" src={asset("/images/logo.jpg")}
                            alt="Proofly" />
                    </div>
                </div>
            </div>
        </BorderLayout>
    );
}