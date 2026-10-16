import Foundation

public struct PresignUploadRequest: Encodable {
    public let fileName: String
    public let fileSizeBytes: Int64
    public let mimeType: String
    public let checksumSha256: String
}

public struct PresignUploadResponse: Decodable {
    public let fileId: String
    public let uploadUrl: String
    public let storedKey: String
    public let expiresAt: String
}

public struct JobResponse: Decodable {
    public let id: String
    public let tool: String
    public let status: String
    public let progress: Int
    public let downloadUrl: String?
}

public struct AiMessageResponse: Decodable {
    public let answer: String
    public let tokensUsed: Int
}

public actor PDFForgeAPIService {
    public static let shared = PDFForgeAPIService()
    private let baseURL = URL(string: "https://api.pdfforge.ai/api/v1/")!
    private var authToken: String? = nil

    public func setAuthToken(_ token: String) {
        self.authToken = token
    }

    public func requestUploadPresign(fileName: String, size: Int64, mime: String, checksum: String) async throws -> PresignUploadResponse {
        let endpoint = baseURL.appendingPathComponent("files/presign-upload")
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let body = PresignUploadRequest(fileName: fileName, fileSizeBytes: size, mimeType: mime, checksumSha256: checksum)
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, (200...299).contains(httpResponse.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return try JSONDecoder().decode(PresignUploadResponse.self, from: data)
    }

    public func queryAi(fileId: String, prompt: String) async throws -> String {
        let endpoint = baseURL.appendingPathComponent("ai/chat")
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token = authToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        let payload = ["fileId": fileId, "question": prompt]
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (data, _) = try await URLSession.shared.data(for: request)
        let res = try JSONDecoder().decode(AiMessageResponse.self, from: data)
        return res.answer
    }
}
