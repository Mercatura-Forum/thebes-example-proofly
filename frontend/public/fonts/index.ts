import localFont from "next/font/local";
import { Inter, Roboto_Mono, Geist, Geist_Mono } from "next/font/google";

const calSemibold = localFont({
    src: "./CalSans-SemiBold.woff2",
    weight: "700",
    variable: "--font-cal",
});

const matter = localFont({
    src: "./Matter.woff2",
    variable: "--font-matter",
});

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
});

const robotoMono = Roboto_Mono({
    subsets: ["latin"],
    variable: "--font-mono",
});

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});
export { inter, robotoMono, calSemibold, matter, geistSans, geistMono };
