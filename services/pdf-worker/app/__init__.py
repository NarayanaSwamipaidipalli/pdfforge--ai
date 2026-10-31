"""
PDFForge AI Worker Engine Application Package
"""
import warnings

# Suppress transitive deprecation notices from external libraries importing fitz
warnings.filterwarnings("ignore", category=FutureWarning, module="fitz")
