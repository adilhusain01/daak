"use client";

import { Suspense, useState } from "react";
import { SiteNav, ProofButton, PageHead } from "@/components/site-nav";
import { ParcelList, type Chain } from "@/components/parcel-list";

/** The public list of every delivery, a page at a time; open one for its stops, money and proofs. */
export default function Live() {
  const [chain, setChain] = useState<Chain | null>(null);
  return (
    <main className="w-full px-5 py-8 sm:px-8 lg:px-16 xl:px-20">
      <SiteNav />
      <PageHead title="Live deliveries" line="Every delivery, read from Arkiv and the public Hedera log. Photos, phone numbers and payment details stay private.">
        {chain?.topicId && <>
          <ProofButton href={`https://hashscan.io/testnet/topic/${chain.topicId}`}>Public handoff log</ProofButton>
          {chain.feeTokenId && <ProofButton href={`https://hashscan.io/testnet/token/${chain.feeTokenId}`}>Rupee credit token</ProofButton>}
          {chain.escrowId && <ProofButton href={`https://hashscan.io/testnet/account/${chain.escrowId}`}>Escrow</ProofButton>}
        </>}
      </PageHead>

      <Suspense>
        <ParcelList endpoint="/api/live" queryKey="live-list" refetchMs={20000} hrefFor={(code) => `/live/${code}`} onChain={setChain}
          tabs={[{ id: "all", label: "All deliveries" }, { id: "transit", label: "On the way" }, { id: "paid", label: "Delivered" }]} />
      </Suspense>
    </main>
  );
}
