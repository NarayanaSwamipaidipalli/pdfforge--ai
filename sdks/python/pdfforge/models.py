from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class FileRecord(BaseModel):
    id: str
    originalName: str
    storedKey: str
    fileSizeBytes: int
    mimeType: str
    pageCount: Optional[int] = None
    checksumSha256: str
    createdAt: str

class PresignUploadResponse(BaseModel):
    fileId: str
    uploadUrl: str
    key: str
    expiresInSeconds: int

class ProcessingJob(BaseModel):
    id: str
    tool: str
    status: str
    priority: str = "NORMAL"
    progress: int = 0
    outputFileKey: Optional[str] = None
    outputFileSizeBytes: Optional[int] = None
    durationMs: Optional[int] = None
    errorMessage: Optional[str] = None
    createdAt: str
    completedAt: Optional[str] = None

class AiSummaryResponse(BaseModel):
    summary: str
    keyPoints: List[str] = Field(default_factory=list)
    pageCount: int = 1
    wordCount: int = 0
    modelUsed: str = "unknown"
    executionTimeMs: int = 0

class Citation(BaseModel):
    pageNumber: int
    textSnippet: str
    similarityScore: float

class AiChatResponse(BaseModel):
    answer: str
    citations: List[Citation] = Field(default_factory=list)
    modelUsed: str

class InvoiceItem(BaseModel):
    description: str
    quantity: float
    unitPrice: float
    amount: float

class InvoiceExtractionResult(BaseModel):
    invoiceNumber: Optional[str] = None
    invoiceDate: Optional[str] = None
    dueDate: Optional[str] = None
    vendorName: Optional[str] = None
    customerName: Optional[str] = None
    subtotal: Optional[float] = None
    taxAmount: Optional[float] = None
    totalAmount: Optional[float] = None
    currency: Optional[str] = None
    items: List[InvoiceItem] = Field(default_factory=list)
    confidenceScore: float = 0.95

class ContractRisk(BaseModel):
    riskLevel: str
    description: str

class ContractAnalysisResult(BaseModel):
    contractTitle: Optional[str] = None
    partiesInvolved: List[str] = Field(default_factory=list)
    effectiveDate: Optional[str] = None
    governingLaw: Optional[str] = None
    keyObligations: List[str] = Field(default_factory=list)
    terminationClauses: List[str] = Field(default_factory=list)
    identifiedRisks: List[ContractRisk] = Field(default_factory=list)
    overallRiskScore: str = "LOW"
