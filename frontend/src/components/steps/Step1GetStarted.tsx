"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useBuildStore, useAuthStore } from "@/lib/store";
import { uploadFile, uploadDriverFile, createProject } from "@/lib/api";
import { Input, BubbleSelect, Button } from "@/components/ui";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Table2,
  Calendar,
  Hash,
  X,
  TrendingUp,
  BriefcaseBusiness,
  Zap,
  HeartPulse,
  Landmark,
  Truck,
  Wrench,
  ArrowRight,
  FolderUp,
  Database,
  ClipboardList,
  Sparkles,
} from "lucide-react";

const USE_CASE_OPTIONS = [
  { id: "retail", label: "Retail & Sales", icon: <BriefcaseBusiness className="w-4 h-4" /> },
  { id: "energy", label: "Energy & Utilities", icon: <Zap className="w-4 h-4" /> },
  { id: "healthcare", label: "Healthcare", icon: <HeartPulse className="w-4 h-4" /> },
  { id: "finance", label: "Finance", icon: <Landmark className="w-4 h-4" /> },
  { id: "supply-chain", label: "Supply Chain", icon: <Truck className="w-4 h-4" /> },
  { id: "other", label: "Other", icon: <Wrench className="w-4 h-4" /> },
];

export default function Step1GetStarted() {
  const {
    projectTitle,
    setProjectTitle,
    projectDescription,
    setProjectDescription,
    useCase,
    setUseCase,
    uploadedFiles,
    addUploadedFile,
    setFileInfo,
    setProjectId,
    completeStep,
    nextStep,
    isLoading,
    setLoading,
    setLoadingMessage,
    columns,
    numericColumns,
    detectedDateCol,
    rowCount,
    previewData,
    columnDtypes,
    removeUploadedFile,
    clearFileInfo,
    driverFiles,
    driverNumericColumns,
    addDriverInfo,
  } = useBuildStore();
  const user = useAuthStore((s) => s.user);

  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const [driverUploadStatus, setDriverUploadStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [driverErrorMsg, setDriverErrorMsg] = useState("");
  const [driverLoading, setDriverLoading] = useState(false);

  const getApiErrorMessage = (err: unknown, fallback: string) => {
    if (
      typeof err === "object" &&
      err !== null &&
      "response" in err &&
      typeof (err as { response?: unknown }).response === "object" &&
      (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
    ) {
      return (err as { response: { data: { detail: string } } }).response.data.detail;
    }
    return fallback;
  };

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (useBuildStore.getState().uploadedFiles.length > 0) return;
      if (acceptedFiles.length === 0) return;
      const file = acceptedFiles[0];
      setLoading(true);
      setLoadingMessage("Uploading & analyzing file...");
      setUploadStatus("idle");
      setErrorMsg("");

      try {
        // Create project if needed
        let activeProjectId = useBuildStore.getState().projectId;
        if (!activeProjectId && user) {
          const proj = await createProject(
            user.user_id,
            projectTitle || file.name.replace(/\.[^.]+$/, ""),
            projectDescription
          );
          setProjectId(proj.project_id);
          activeProjectId = proj.project_id;
        }

        const result = await uploadFile(file, activeProjectId || undefined);
        if (result.project_id) {
          // Keep store project id aligned with backend upload state.
          setProjectId(result.project_id);
        }
        addUploadedFile(file.name);
        setFileInfo({
          columns: result.columns || [],
          numericColumns: result.numeric_columns || [],
          detectedDateCol: result.detected_date_col || null,
          rowCount: result.rows || 0,
          previewData: result.preview || [],
          columnDtypes: result.dtypes || {},
        });
        setUploadStatus("success");
      } catch (err: unknown) {
        setErrorMsg(getApiErrorMessage(err, "Upload failed. Try again."));
        setUploadStatus("error");
      } finally {
        setLoading(false);
        setLoadingMessage("");
      }
    },
    [
      user,
      projectTitle,
      projectDescription,
      setProjectId,
      addUploadedFile,
      setFileInfo,
      setLoading,
      setLoadingMessage,
    ]
  );

  const onDropDrivers = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      setDriverLoading(true);
      setDriverUploadStatus("idle");
      setDriverErrorMsg("");

      try {
        let activeProjectId = useBuildStore.getState().projectId;
        for (const file of acceptedFiles) {
          const result = await uploadDriverFile(file, activeProjectId || undefined);
          if (result.project_id) {
            setProjectId(result.project_id);
            activeProjectId = result.project_id;
          }
          addDriverInfo({
            fileName: file.name,
            columns: result.columns || [],
            numericColumns: result.numeric_columns || [],
            detectedDateCol: result.detected_date_col || null,
            rowCount: result.rows || 0,
            previewData: result.preview || [],
            columnDtypes: result.dtypes || {},
          });
        }
        setDriverUploadStatus("success");
      } catch (err: unknown) {
        setDriverErrorMsg(getApiErrorMessage(err, "Driver upload failed. Try again."));
        setDriverUploadStatus("error");
      } finally {
        setDriverLoading(false);
      }
    },
    [addDriverInfo, setProjectId]
  );

  const dropzoneAccept = {
    "text/csv": [".csv"],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    "application/vnd.ms-excel": [".xls"],
    "text/plain": [".txt"],
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: dropzoneAccept,
    maxFiles: 1,
  });

  const {
    getRootProps: getDriverRootProps,
    getInputProps: getDriverInputProps,
    isDragActive: isDriverDragActive,
  } = useDropzone({
    onDrop: onDropDrivers,
    accept: dropzoneAccept,
  });

  const canContinue =
    uploadedFiles.length > 0 && rowCount > 0;

  const hasMainDataset = uploadedFiles.length > 0 && rowCount > 0;
  const showMainUploadSuccess = uploadStatus === "success" || hasMainDataset;

  const handleContinue = () => {
    completeStep(1);
    nextStep();
  };

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/80 to-slate-800/40 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-teal-500/10 p-2 text-teal-300">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-white">Step 1: Project Setup</h2>
            <p className="text-sm text-slate-400">
              Give your project a name, then upload your main data to get started.
            </p>
          </div>
        </div>
      </div>

      {/* Project Details */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-5">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-teal-300" />
          Project Details
        </h3>
        <Input
          label="Project Title"
          placeholder="e.g. Weekly Sales Forecast"
          value={projectTitle}
          onChange={(e) => setProjectTitle(e.target.value)}
        />
        <Input
          label="Project Description (optional)"
          placeholder="Tell us what you want to forecast"
          value={projectDescription}
          onChange={(e) => setProjectDescription(e.target.value)}
        />
        <BubbleSelect
          label="Use Case"
          options={USE_CASE_OPTIONS}
          selected={useCase}
          onSelect={setUseCase}
          layout="grid"
          columns={2}
          fullWidth
        />
      </div>

      {/* Upload */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <FolderUp className="w-5 h-5 text-teal-300" />
          Upload Target Data
        </h3>

        {uploadedFiles.length === 0 ? (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${
              isDragActive
                ? "border-teal-500 bg-teal-900/10"
                : "border-slate-700 bg-slate-800/30 hover:border-slate-600"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-400 font-medium">
              {isDragActive
                ? "Drop your file here"
                : "Drag and drop a CSV or Excel file, or click to choose one"}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              Use a file with a date column and at least one number column
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-300">
            Target file uploaded. Remove it first to upload a different target file.
          </div>
        )}

        {/* Status */}
        {isLoading && (
          <div className="mt-4 flex items-center gap-3 text-teal-400 text-sm">
            <div className="w-4 h-4 border-2 border-teal-400/30 border-t-teal-400 rounded-full animate-spin" />
            Uploading & analyzing...
          </div>
        )}
        {showMainUploadSuccess && (
          <div className="mt-4 flex items-center gap-3 text-emerald-400 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            File uploaded successfully
          </div>
        )}
        {uploadStatus === "error" && (
          <div className="mt-4 flex items-center gap-3 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            {errorMsg}
          </div>
        )}

        {/* Uploaded file chips */}
        {uploadedFiles.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {uploadedFiles.map((f) => (
              <span
                key={f}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-300 group"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-teal-400" />
                {f}
                <button
                  type="button"
                  onClick={() => {
                    removeUploadedFile(f);
                    clearFileInfo();
                    setUploadStatus("idle");
                  }}
                  className="ml-1 p-0.5 rounded-md text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors"
                  aria-label={`Remove ${f}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Optional Driver Upload */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-300" />
            Driver Data
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-500">
            Optional
          </span>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Optional: add extra data like weather, promotions, or events to help the model learn.
        </p>

        <div
          {...getDriverRootProps()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
            isDriverDragActive
              ? "border-blue-500 bg-blue-900/10"
              : "border-slate-700 bg-slate-800/30 hover:border-slate-600"
          }`}
        >
          <input {...getDriverInputProps()} />
          <TrendingUp className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <p className="text-slate-400 font-medium text-sm">
            {isDriverDragActive
              ? "Drop driver files here"
              : "Drag and drop one or more driver files, or click to choose"}
          </p>
          <p className="text-xs text-slate-600 mt-1">
            Use the same date format as your main dataset
          </p>
        </div>

        {driverLoading && (
          <div className="mt-3 flex items-center gap-3 text-blue-400 text-sm">
            <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
            Uploading & analyzing driver data...
          </div>
        )}
        {driverUploadStatus === "error" && (
          <div className="mt-3 flex items-center gap-3 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            {driverErrorMsg}
          </div>
        )}

        {driverFiles.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="text-sm text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {driverFiles.length} driver file{driverFiles.length !== 1 ? "s" : ""} loaded
            </div>
            <div className="grid gap-2">
              {driverFiles.map((driver) => (
                <div
                  key={driver.fileName}
                  className="rounded-xl border border-slate-700 bg-slate-800/50 p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-2 text-sm text-slate-300">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-blue-400" />
                      {driver.fileName}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {driver.detectedDateCol && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-900/30 border border-blue-800 text-xs text-blue-300">
                        <Calendar className="w-3 h-3" />
                        Date: {driver.detectedDateCol}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-300">
                      <Hash className="w-3 h-3" />
                      {driver.numericColumns.length} numeric column
                      {driver.numericColumns.length !== 1 ? "s" : ""}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-300">
                      {driver.rowCount.toLocaleString()} rows
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {driverNumericColumns.length > 0 && (
              <p className="text-xs text-slate-500">
                Combined numeric driver columns available: {driverNumericColumns.length}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Data Preview */}
      {hasMainDataset && previewData.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Table2 className="w-5 h-5 text-teal-400" />
              Data Preview
            </h3>
            <span className="text-xs text-slate-500">
              Showing {previewData.length} of {rowCount} rows &middot; {columns.length} columns
            </span>
          </div>

          {/* Summary chips */}
          <div className="flex flex-wrap gap-2">
            {detectedDateCol && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-teal-900/30 border border-teal-800 text-xs text-teal-300">
                <Calendar className="w-3 h-3" />
                Date: {detectedDateCol}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300">
              <Hash className="w-3 h-3" />
              {numericColumns.length} numeric column{numericColumns.length !== 1 ? "s" : ""}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300">
              {rowCount.toLocaleString()} rows
            </span>
          </div>

          {/* Scrollable table */}
          <div className="overflow-auto max-h-80 rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-800/90 backdrop-blur">
                  {columns.map((col) => (
                    <th
                      key={col}
                      className={`px-3 py-2 text-left font-medium whitespace-nowrap border-b border-slate-700 ${
                        col === detectedDateCol
                          ? "text-teal-400"
                          : numericColumns.includes(col)
                          ? "text-blue-400"
                          : "text-slate-400"
                      }`}
                    >
                      <div>{col}</div>
                      <div className="text-[10px] font-normal text-slate-600 mt-0.5">
                        {columnDtypes[col] || "-"}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                  >
                    {columns.map((col) => (
                      <td
                        key={col}
                        className="px-3 py-1.5 whitespace-nowrap text-slate-300"
                      >
                        {row[col] === null || row[col] === undefined ? (
                          <span className="text-slate-600 italic">null</span>
                        ) : (
                          String(row[col])
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Continue */}
      <div className="flex justify-end">
        <Button onClick={handleContinue} disabled={!canContinue} size="lg">
          Continue to Process Data
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
