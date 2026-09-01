import React from 'react'
import BorderLayout from '../layout/borderLayout'
import Link from 'next/link'
import Image from 'next/image'
import { asset } from "@/lib/asset";

export default function Footer() {
    return (
        <BorderLayout id='footer'>
            {/* pt-28 */}
            <footer className="flex flex-col gap-12  h-fit pt-8">
                <div className="flex justify-between items-start text-left gap-8 flex-wrap">
                    <div className="flex flex-col items-start justify-center gap-4">
                        <p className="font-medium">Everything by Proofly</p>
                        <ul className="flex flex-col items-start justify-center gap-3 text-sm">
                            <li>
                                <Link
                                    className="opacity-80 hover:opacity-100"
                                    href="/"
                                >
                                    Proofly
                                </Link>
                            </li>
                            <li>
                                <Link
                                    target="_blank"
                                    className="opacity-80 hover:opacity-100"
                                    href="/"
                                >
                                    Proofly Blocks
                                </Link>
                            </li>
                        </ul>
                    </div>
                    <div className="flex flex-col items-start justify-center gap-4">
                        <p className="font-medium">Components</p>
                        <ul className="flex flex-col items-start justify-center gap-3 text-sm">
                            <li>
                                <Link
                                    className="opacity-80 hover:opacity-100"
                                    href="/"
                                >
                                    Introduction
                                </Link>
                            </li>
                            <li>
                                <Link
                                    className="opacity-80 hover:opacity-100"
                                    href="/"
                                >
                                    Installation
                                </Link>
                            </li>
                            <li>
                                <Link
                                    className="opacity-80 hover:opacity-100"
                                    href="/"
                                >
                                    RTL Setup
                                </Link>
                            </li>
                            <li>
                                <Link
                                    className="opacity-80 hover:opacity-100"
                                    href="/ "
                                >
                                    Roadmap
                                </Link>
                            </li>
                            <li>
                                <Link
                                    className="opacity-80 hover:opacity-100"
                                    href="/"
                                >
                                    Changelog
                                </Link>
                            </li>
                        </ul>
                    </div>
                    <div className="flex flex-col items-start justify-center gap-4">
                        <p className="font-medium">Pro Features</p>
                        <ul className="flex flex-col items-start justify-center gap-3 text-sm">
                            <li>
                                <Link
                                    className="opacity-80 hover:opacity-100"
                                    href="/"
                                >
                                    Proofly Blocks
                                </Link>
                            </li>
                            <li>
                                <Link
                                    className="opacity-80 hover:opacity-100"
                                    href="/"
                                >
                                    Pricing
                                </Link>
                            </li>
                            <li>
                                <Link
                                    className="opacity-80 hover:opacity-100"
                                    href="/"
                                >
                                    FAQ
                                </Link>
                            </li>
                        </ul>
                    </div>
                    <div className="flex flex-col items-start justify-center gap-4">
                        <p className="font-medium">Other</p>
                        <ul className="flex flex-col items-start justify-center gap-3 text-sm">
                            <li>
                                <Link
                                    className="opacity-80 hover:opacity-100"
                                    href="/"
                                    target="_blank"
                                >
                                    Discord Server
                                </Link>
                            </li>
                            <li>
                                <Link
                                    className="opacity-80 hover:opacity-100"
                                    href="/"
                                    target="_blank"
                                >
                                    Github
                                </Link>
                            </li>
                            <li>
                                <Link
                                    className="opacity-80 hover:opacity-100"
                                    href="/"
                                    target="_blank"
                                >
                                    Contact us
                                </Link>
                            </li>
                            <li>
                                <Link
                                    className="opacity-80 hover:opacity-100"
                                    href="/"
                                    target="_blank"
                                >
                                    llms.txt
                                </Link>
                            </li>
                            <li>
                                <Link
                                    className="opacity-80 hover:opacity-100"
                                    href="/"
                                    target="_blank"
                                >
                                    llms-full.txt
                                </Link>
                            </li>
                            <li>
                                <Link
                                    className="opacity-80 hover:opacity-100"
                                    href="/"
                                    target="_blank"
                                >
                                    Ikiform
                                </Link>
                            </li>
                        </ul>
                    </div>{" "}
                    <div className="flex flex-col items-start justify-center gap-4">
                        <p className="font-medium">Legal</p>
                        <ul className="flex flex-col items-start justify-center gap-3 text-sm">
                            <li>
                                <Link
                                    className="opacity-80 hover:opacity-100"
                                    href="/"
                                    target="_blank"
                                >
                                    Privacy Policy
                                </Link>
                            </li>
                            <li>
                                <Link
                                    className="opacity-80 hover:opacity-100"
                                    href="/"
                                    target="_blank"
                                >
                                    Terms of Service
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>
                <div className="flex items-end justify-end relative ">
                    <Image
                        src={asset("/svg/Proofly-log.svg")}
                        width={0}
                        height={0}
                        sizes="100vw"
                        alt="logo"
                        className="pointer-events-none block w-full h-auto relative z-10"
                        style={{
                            filter: "brightness(30%) grayscale(100%)",
                            maskImage:
                                "linear-gradient(to top, transparent 0%, var(--color-gray-700) 100%)",
                            WebkitMaskImage:
                                "linear-gradient(to top, transparent 0%, var(--color-gray-700) 100%)",
                        }}
                    />
                </div>
            </footer>
        </BorderLayout>
    )
}
