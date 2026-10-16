package com.pdfforge.ai.data

import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.RequestBody
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.*
import java.util.concurrent.TimeUnit

data class PresignUploadRequest(
    val fileName: String,
    val fileSizeBytes: Long,
    val mimeType: String,
    val checksumSha256: String
)

data class PresignUploadResponse(
    val fileId: String,
    val uploadUrl: String,
    val storedKey: String,
    val expiresAt: String
)

data class CreateJobRequest(
    val tool: String,
    val fileIds: List<String>,
    val parameters: Map<String, Any> = emptyMap()
)

data class JobStatusResponse(
    val id: String,
    val tool: String,
    val status: String,
    val progress: Int,
    val downloadUrl: String?,
    val errorMessage: String?
)

data class AiChatRequest(
    val fileId: String,
    val question: String
)

data class AiChatResponse(
    val answer: String,
    val citations: List<AiCitation>,
    val tokensUsed: Int
)

data class AiCitation(
    val pageNumber: Int,
    val snippetText: String
)

interface PdfForgeApi {
    @POST("api/v1/files/presign-upload")
    suspend fun getPresignedUpload(
        @Header("Authorization") token: String,
        @Body request: PresignUploadRequest
    ): PresignUploadResponse

    @POST("api/v1/pdf/jobs")
    suspend fun dispatchJob(
        @Header("Authorization") token: String,
        @Body request: CreateJobRequest
    ): JobStatusResponse

    @GET("api/v1/pdf/jobs/{id}")
    suspend fun getJobStatus(
        @Header("Authorization") token: String,
        @Path("id") jobId: String
    ): JobStatusResponse

    @POST("api/v1/ai/chat")
    suspend fun askAi(
        @Header("Authorization") token: String,
        @Body request: AiChatRequest
    ): AiChatResponse
}

object NetworkClient {
    private const val BASE_URL = "https://api.pdfforge.ai/"

    private val okHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    val api: PdfForgeApi = Retrofit.Builder()
        .baseUrl(BASE_URL)
        .client(okHttpClient)
        .addConverterFactory(GsonConverterFactory.create())
        .build()
        .create(PdfForgeApi::class.java)
}
