import io
import PyPDF2
import docx
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from ...models.document_embedding import Document
from ...services.document_service import DocumentService
from ...models.study_group_membership import StudyGroupMembership, MemberRole
from ...core.database import get_db
from ...core.security import get_current_user
from ...models.user import User


router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_EXTENSIONS = {'.pdf', '.txt', '.docx', '.doc', '.md'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

def extract_text_from_file(file_content: bytes, filename: str) -> str:
    """Extract text from various file formats"""
    extension = filename[filename.rfind('.'):].lower()
    
    if extension == '.txt' or extension == '.md':
        return file_content.decode('utf-8', errors='ignore')
    
    elif extension == '.pdf':
        try:
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text()
            return text
        except Exception as e:
            raise ValueError(f"Failed to extract PDF: {str(e)}")
    
    elif extension in ['.docx', '.doc']:
        try:
            doc = docx.Document(io.BytesIO(file_content))
            text = "\n".join([para.text for para in doc.paragraphs])
            return text
        except Exception as e:
            raise ValueError(f"Failed to extract document: {str(e)}")
    
    raise ValueError(f"Unsupported file format: {extension}")

@router.post("/upload/{group_id}")
async def upload_document(
    group_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload a document to a study group"""
    
    # Check if user is member of the group
    membership = db.query(StudyGroupMembership).filter(
        StudyGroupMembership.group_id == group_id,
        StudyGroupMembership.user_id == current_user.id,
        StudyGroupMembership.is_active == True
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this study group"
        )
    
    # Validate file extension
    filename = file.filename.lower()
    extension = filename[filename.rfind('.'):] if '.' in filename else ''
    
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Read file content
    try:
        content = await file.read()
        
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size exceeds {MAX_FILE_SIZE // (1024*1024)}MB limit"
            )
        
        # Extract text from file
        text_content = extract_text_from_file(content, file.filename)
        
        if not text_content or len(text_content.strip()) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not extract text from document"
            )
        
        # Process document through RAG pipeline
        document = DocumentService.process_document(
            db=db,
            group_id=group_id,
            uploader_id=current_user.id,
            filename=file.filename,
            file_type=extension.lstrip('.'),
            text_content=text_content,
            file_size=len(content)
        )
        
        return {
            "id": document.id,
            "filename": document.filename,
            "file_type": document.file_type,
            "file_size": document.file_size,
            "created_at": document.created_at.isoformat(),
            "uploader": {
                "id": str(document.uploader.id),
                "username": document.uploader.username
            }
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process document: {str(e)}"
        )

@router.get("/group/{group_id}")
async def get_group_documents(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all documents in a study group"""
    
    # Check if user is member of the group
    membership = db.query(StudyGroupMembership).filter(
        StudyGroupMembership.group_id == group_id,
        StudyGroupMembership.user_id == current_user.id,
        StudyGroupMembership.is_active == True
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this study group"
        )
    
    documents = DocumentService.get_group_documents(db, group_id)
    
    return [
        {
            "id": doc.id,
            "filename": doc.filename,
            "file_type": doc.file_type,
            "file_size": doc.file_size,
            "created_at": doc.created_at.isoformat(),
            "uploader": {
                "id": str(doc.uploader.id),
                "username": doc.uploader.username
            }
        }
        for doc in documents
    ]

@router.delete("/{document_id}/group/{group_id}")
async def delete_document(
    document_id: int,
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a document from a study group"""
    
    # Check if user is member of the group
    membership = db.query(StudyGroupMembership).filter(
        StudyGroupMembership.group_id == group_id,
        StudyGroupMembership.user_id == current_user.id,
        StudyGroupMembership.is_active == True
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this study group"
        )
    
    # Get document to check uploader
    document = DocumentService.get_document_by_id(db, document_id, group_id)
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    # Only document uploader or group admin can delete
    is_admin = membership.role == MemberRole.ADMIN
    is_uploader = document.uploader_id == current_user.id
    
    if not (is_admin or is_uploader):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only document uploader or group admin can delete this document"
        )
    
    success = DocumentService.delete_document(db, document_id, group_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    return {"message": "Document deleted successfully"}
