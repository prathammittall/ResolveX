import React from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import TrustBar from '../components/TrustBar';
import FeatureDeepDive from '../components/FeatureDeepDive';
import MetricsSection from '../components/MetricsSection';
import Testimonials from '../components/Testimonials';
import PricingSection from '../components/PricingSection';
import CtaBanner from '../components/CtaBanner';
import Footer from '../components/Footer';

export const metadata = {
  title: 'ResolveX — Intelligent Engineering Operations in One Workspace',
  description:
    'ResolveX connects project planning, API monitoring, incident response, and service visibility so your team can ship with confidence and recover instantly.',
};

export default function Page() {
  return (
    <main className="min-h-screen bg-[#fafaf9] text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      <Navbar />
      <Hero />
      <TrustBar />
      <FeatureDeepDive />
      <MetricsSection />
      <Testimonials />
      <PricingSection />
      <CtaBanner />
      <Footer />
    </main>
  );
}