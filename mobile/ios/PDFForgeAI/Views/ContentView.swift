import SwiftUI
import VisionKit

struct DocumentScannerView: UIViewControllerRepresentable {
    @Binding var scannedPDFData: Data?
    @Environment(\.presentationMode) var presentationMode

    func makeUIViewController(context: Context) -> VNDocumentCameraViewController {
        let scanner = VNDocumentCameraViewController()
        scanner.delegate = context.coordinator
        return scanner
    }

    func updateUIViewController(_ uiViewController: VNDocumentCameraViewController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    class Coordinator: NSObject, VNDocumentCameraViewControllerDelegate {
        let parent: DocumentScannerView

        init(_ parent: DocumentScannerView) {
            self.parent = parent
        }

        func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
            // Convert scanned pages to consolidated PDF bytes
            let pdfDocument = NSMutableData()
            // Write PDF representation...
            parent.scannedPDFData = pdfDocument as Data
            parent.presentationMode.wrappedValue.dismiss()
        }

        func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
            parent.presentationMode.wrappedValue.dismiss()
        }

        func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) {
            parent.presentationMode.wrappedValue.dismiss()
        }
    }
}

struct ContentView: View {
    @State private var showingScanner = false
    @State private var scannedData: Data? = nil
    @State private var selectedTab = 0

    let tools = [
        ("Merge PDF", "square.stack.3d.up.fill", Color.blue),
        ("Compress PDF", "arrow.down.right.and.arrow.up.left", Color.green),
        ("PDF to Word", "doc.text.fill", Color.orange),
        ("AI Document Chat", "brain.head.profile", Color.purple),
        ("Sign & Certify", "signature", Color.red),
        ("OCR Scanner", "text.viewfinder", Color.teal)
    ]

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 20) {
                    // VisionKit Quick Scan Hero
                    Button(action: { showingScanner = true }) {
                        HStack(spacing: 16) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 16)
                                    .fill(LinearGradient(colors: [.blue, .indigo], startPoint: .topLeading, endPoint: .bottomTrailing))
                                    .frame(width: 56, height: 56)
                                Image(systemName: "camera.viewfinder")
                                    .font(.title2)
                                    .foregroundColor(.white)
                            }

                            VStack(alignment: .leading, spacing: 4) {
                                Text("Scan Physical Documents")
                                    .font(.headline)
                                    .foregroundColor(.primary)
                                Text("Auto edge-detection & OCR search")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption.bold())
                                .foregroundColor(.secondary)
                        }
                        .padding()
                        .background(Color(UIColor.secondarySystemBackground))
                        .cornerRadius(22)
                    }
                    .sheet(isPresented: $showingScanner) {
                        DocumentScannerView(scannedPDFData: $scannedData)
                    }

                    // Tools Grid
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Core Tools")
                            .font(.title3.bold())

                        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 14) {
                            ForEach(tools, id: \.0) { tool in
                                VStack(alignment: .leading, spacing: 10) {
                                    Image(systemName: tool.1)
                                        .font(.title3)
                                        .foregroundColor(tool.2)
                                        .frame(width: 36, height: 36)
                                        .background(tool.2.opacity(0.12))
                                        .clipShape(RoundedRectangle(cornerRadius: 10))

                                    Text(tool.0)
                                        .font(.subheadline.bold())
                                        .foregroundColor(.primary)
                                }
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding()
                                .background(Color(UIColor.secondarySystemBackground))
                                .cornerRadius(18)
                            }
                        }
                    }
                }
                .padding()
            }
            .navigationTitle("PDFForge AI")
            .background(Color(UIColor.systemGroupedBackground))
        }
    }
}
