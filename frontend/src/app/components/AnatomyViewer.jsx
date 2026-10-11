"use client";

import React, { Suspense, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import {
  Activity,
  FileText,
  Info,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  ShieldCheck,
} from "lucide-react";
import { getAbnormalAnatomicalFindings } from "../../services/healthInsights";

const REGIONS = [
  { id: "brain", label: "Brain", system: "Nervous system" },
  { id: "thyroid", label: "Thyroid", system: "Endocrine system" },
  { id: "heart", label: "Heart", system: "Cardiovascular system" },
  { id: "lungs", label: "Lungs", system: "Respiratory system" },
  { id: "liver", label: "Liver", system: "Digestive system" },
  { id: "stomach", label: "Stomach", system: "Digestive system" },
  { id: "kidneys", label: "Kidneys", system: "Urinary system" },
];

const REGION_MARKERS = {
  brain: [0, 0.91, 0.17],
  thyroid: [0, 0.66, 0.17],
  heart: [0.045, 0.26, 0.19],
  lungs: [0, 0.38, 0.18],
  liver: [0.16, -0.18, 0.17],
  stomach: [-0.10, -0.18, 0.17],
  kidneys: [0, -0.42, 0.08],
};

function isSupportedMapping(finding) {
  return (
    finding?.regionId &&
    ["verified", "confirmed"].includes(
      String(finding.mappingStatus || "").toLowerCase()
    ) &&
    REGIONS.some((region) => region.id === finding.regionId)
  );
}

function HumanModel() {
  const { scene } = useGLTF("/models/medipilot-human.glb");

  // Clone the scene before using it in the viewer.
  const model = useMemo(() => scene.clone(true), [scene]);

  return (
    <primitive
      object={model}
      scale={2.4}
      position={[0, 0, 0]}
    />
  );
}

function RegionMarker({
  regionId,
  count,
  outOfRangeCount,
  recordMentionCount,
  selected,
}) {
  const position = REGION_MARKERS[regionId];

  if (!position) return null;

  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[selected ? 0.04 : 0.033, 20, 20]} />
        <meshBasicMaterial color="#ff4658" toneMapped={false} />
      </mesh>

      <mesh>
        <sphereGeometry args={[selected ? 0.078 : 0.065, 20, 20]} />
        <meshBasicMaterial
          color="#ff4658"
          transparent
          opacity={0.32}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <Html
        position={[0.1, 0.055, 0]}
        distanceFactor={4}
      >
        <div className="whitespace-nowrap rounded-lg border border-rose-400/60 bg-slate-950/95 px-2.5 py-1.5 text-xs font-semibold text-rose-200 shadow-lg">
          {REGIONS.find((r) => r.id === regionId)?.label} ·{" "}
          {outOfRangeCount > 0 && `${outOfRangeCount} report flag${outOfRangeCount === 1 ? "" : "s"}`}
          {outOfRangeCount > 0 && recordMentionCount > 0 && " · "}
          {recordMentionCount > 0 && `${recordMentionCount} record mention${recordMentionCount === 1 ? "" : "s"}`}
          {!outOfRangeCount && !recordMentionCount && `${count} reviewed finding${count === 1 ? "" : "s"}`}
        </div>
      </Html>
    </group>
  );
}

function ViewerScene({ selectedRegion, abnormalRegionCounts, controlsRef }) {
  return (
    <>
      <color attach="background" args={["#071827"]} />

      <ambientLight intensity={1.5} />

      <directionalLight
        position={[3, 5, 4]}
        intensity={2}
        color="#e1fbff"
      />

      <directionalLight
        position={[-3, 1, -2]}
        intensity={1.5}
        color="#3ec7cc"
      />

      <Suspense
        fallback={
          <Html center>
            <div className="whitespace-nowrap rounded-xl bg-slate-900 px-4 py-3 text-sm text-white">
              Loading anatomy model...
            </div>
          </Html>
        }
      >
        <HumanModel />

        {Object.entries(abnormalRegionCounts).map(([regionId, count]) => (
          <RegionMarker
            key={regionId}
            regionId={regionId}
            count={count.total}
            outOfRangeCount={count.outOfRange}
            recordMentionCount={count.recordMentions}
            selected={regionId === selectedRegion}
          />
        ))}
      </Suspense>

      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={[0, 0, 0]}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={1.8}
        maxDistance={6}
        rotateSpeed={0.7}
        zoomSpeed={0.8}
      />
    </>
  );
}

export default function AnatomyViewer({
  findings = [],
  onOpenDocument,
  onSelectRegion,
  compact = false,
}) {
  const [selectedRegion, setSelectedRegion] = useState(null);
  const controlsRef = useRef(null);

  const safeFindings = useMemo(
    () => Array.isArray(findings) ? findings : [],
    [findings],
  );
  const abnormalFindings = useMemo(
    () => getAbnormalAnatomicalFindings(safeFindings),
    [safeFindings],
  );
  const abnormalRegionCounts = useMemo(
    () => abnormalFindings.reduce((counts, finding) => {
      const regionCounts = counts[finding.regionId] || {
        total: 0,
        outOfRange: 0,
        recordMentions: 0,
      };
      regionCounts.total += 1;
      if (finding.status === "mentioned") {
        regionCounts.recordMentions += 1;
      } else {
        regionCounts.outOfRange += 1;
      }
      counts[finding.regionId] = regionCounts;
      return counts;
    }, {}),
    [abnormalFindings],
  );

  const activeRegion =
    selectedRegion || abnormalFindings[0]?.regionId || null;

  const selected = REGIONS.find(
    (region) => region.id === activeRegion
  );

  const linkedFindings = safeFindings.filter(
    (finding) =>
      isSupportedMapping(finding) &&
      finding.regionId === activeRegion
  );

  const selectRegion = (regionId) => {
    setSelectedRegion(regionId);
    onSelectRegion?.(regionId);
  };

  const resetView = () => {
    setSelectedRegion(null);
    controlsRef.current?.reset();
  };

  return (
    <main className={`space-y-5 bg-slate-50 p-4 sm:p-6 anatomy-viewer${compact ? " anatomy-viewer-compact" : ""}`}>
      {!compact && <header>
        <div className="flex items-center gap-2 text-sm font-medium text-teal-800">
          <Activity size={17} />
          MediPilot AI / Health Intelligence
        </div>

        <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">
          AI Health Visualizer
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Explore your anatomy and view findings linked to your medical records.
        </p>
      </header>}

      <div className={`grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]${compact ? " anatomy-viewer-layout-compact" : ""}`}>
        <section className="overflow-hidden rounded-3xl border border-slate-700 bg-[#071827] anatomy-model-card">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 p-4 anatomy-model-toolbar">
            <div>
              <h2 className="font-semibold text-white">
                3D Anatomy Model
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Drag to rotate · Scroll to zoom
              </p>
            </div>

            <div className="flex gap-2 anatomy-model-controls">
              <button
                type="button"
                aria-label="Zoom in"
                onClick={() => {
                  controlsRef.current?.dollyIn(1.2);
                  controlsRef.current?.update();
                }}
                className="rounded-lg border border-white/15 p-2 text-white hover:bg-white/10"
              >
                <ZoomIn size={18} />
              </button>

              <button
                type="button"
                aria-label="Zoom out"
                onClick={() => {
                  controlsRef.current?.dollyOut(1.2);
                  controlsRef.current?.update();
                }}
                className="rounded-lg border border-white/15 p-2 text-white hover:bg-white/10"
              >
                <ZoomOut size={18} />
              </button>

              <button
                type="button"
                aria-label="Reset view"
                onClick={resetView}
                className="rounded-lg border border-white/15 p-2 text-white hover:bg-white/10"
              >
                <RotateCcw size={18} />
              </button>
            </div>
          </div>

          <div className="relative h-[460px] sm:h-[590px] anatomy-canvas-wrap">
            <Canvas
              camera={{
                position: [0, 0.05, 3.7],
                fov: 35,
                near: 0.1,
                far: 100,
              }}
              dpr={[1, 1.5]}
              gl={{ antialias: true, alpha: false }}
            >
              <ViewerScene
                selectedRegion={activeRegion}
                abnormalRegionCounts={abnormalRegionCounts}
                controlsRef={controlsRef}
              />
            </Canvas>

            <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center gap-2 rounded-xl bg-slate-950/75 p-3 text-xs leading-5 text-slate-300 anatomy-model-note">
              <Info size={17} className="shrink-0 text-teal-300" />
              {abnormalFindings.length
                ? abnormalFindings.some((finding) => finding.demoSample)
                  ? "Demo mode: the red thyroid marker is generated from a fictional sample TSH value above its illustrative sample interval. It does not describe a real person or indicate a diagnosis."
                  : "Red markers show patient-reviewed out-of-range report values, explicit diagnosis text, or saved condition notes mapped to a body region. Locations are approximate indicators, not diagnoses or proof of organ damage."
                : "No patient-reviewed, supported report findings are available to highlight. This does not mean every result is normal or that records contain no other mentions."}
            </div>
          </div>

          <div className="border-t border-white/10 p-4 anatomy-region-controls">
            <p className="mb-3 text-sm font-semibold text-white">
              Reported findings by region
            </p>

            <div className="flex flex-wrap gap-2">
              {REGIONS.map((region) => (
                <button
                  key={region.id}
                  type="button"
                  onClick={() => selectRegion(region.id)}
                  className={`rounded-xl border px-3 py-2 text-sm transition ${
                    activeRegion === region.id
                      ? "border-teal-300 bg-teal-300/15 text-teal-200"
                      : "border-white/15 text-slate-300 hover:border-teal-300"
                  }`}
                >
                  {region.label}
                    {abnormalRegionCounts[region.id]?.total > 0 && (
                      <span className="ml-1.5 inline-flex min-w-5 justify-center rounded-full bg-rose-500/20 px-1.5 text-xs font-bold text-rose-200">
                        {abnormalRegionCounts[region.id].total}
                      </span>
                    )}
                </button>
              ))}
            </div>
          </div>
        </section>

        {!compact && <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-bold text-slate-950">
              {selected?.label || "Medical Findings"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {selected?.system ||
                "Select a region to review source-linked findings."}
            </p>
            {selected && abnormalRegionCounts[activeRegion]?.total > 0 && (
              <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm leading-6 text-rose-900">
                {abnormalRegionCounts[activeRegion].outOfRange > 0 && (
                  <>{abnormalRegionCounts[activeRegion].outOfRange} patient-reviewed report value{abnormalRegionCounts[activeRegion].outOfRange === 1 ? "" : "s"} for this region were flagged above or below the reported range. </>
                )}
                {abnormalRegionCounts[activeRegion].recordMentions > 0 && (
                  <>{abnormalRegionCounts[activeRegion].recordMentions} patient-reviewed report or saved-condition text mention{abnormalRegionCounts[activeRegion].recordMentions === 1 ? "" : "s"} this region. </>
                )}
                These are report indicators, not proof of a disease or organ damage, and patient review is not clinician verification.
              </p>
            )}

            {selected && linkedFindings.length === 0 && (
              <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                No findings with a verified anatomical mapping were
                supplied for this region. This does not mean the organ
                is healthy or unhealthy.
              </div>
            )}

            <div className="mt-4 space-y-3">
              {linkedFindings.map((finding, index) => (
                <article
                  key={finding.id || finding._id || index}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="flex items-start gap-2">
                    <FileText
                      size={18}
                      className="mt-1 shrink-0 text-teal-700"
                    />

                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-slate-900">
                        {finding.title ||
                          finding.testName ||
                          "Recorded finding"}
                      </h3>

                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {finding.description ||
                          "No additional description is available."}
                      </p>
                      {finding.findingType === "DIAGNOSIS_MENTION" && finding.status === "mentioned" && (
                        <span className="mt-2 inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-800">
                          Mentioned in patient-reviewed report text · not clinician-verified
                        </span>
                      )}
                      {finding.findingType === "PATIENT_CONDITION_MENTION" && (
                        <span className="mt-2 inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-800">
                          Mentioned in a patient-entered note · not clinician-verified
                        </span>
                      )}
                      {["above", "below", "critical"].includes(finding.status) && (
                        <span className="mt-2 inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-800">
                          {finding.status === "critical" ? "Reported critical flag" : `Reported ${finding.status} range`}
                        </span>
                      )}

                      {finding.value != null && (
                        <p className="mt-2 font-semibold text-slate-900">
                          {String(finding.value)}
                          {finding.unit ? ` ${finding.unit}` : ""}
                        </p>
                      )}

                      {(finding.documentName || finding.sourceTitle || finding.sourceType) && (
                        <p className="mt-2 text-xs text-slate-500">
                          Source: {finding.documentName || finding.sourceTitle || finding.sourceType}
                          {finding.sourcePage != null
                            ? ` · Page ${finding.sourcePage}`
                            : ""}
                        </p>
                      )}

                      {finding.documentId && onOpenDocument && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenDocument(finding.documentId)
                          }
                          className="mt-3 text-sm font-semibold text-teal-800 hover:text-teal-950"
                        >
                          Open source report →
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck
                size={19}
                className="mt-0.5 shrink-0 text-teal-800"
              />
              <p className="text-sm leading-6 text-teal-950">
                This is an educational visualization of anatomy and
                recorded medical findings, not a diagnostic tool.
                Only supported, verified mappings are displayed.
              </p>
            </div>
          </div>
        </section>}
      </div>
    </main>
  );
}

useGLTF.preload("/models/medipilot-human.glb");