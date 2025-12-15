from sqlalchemy.orm import Session
from ..models.group_agent_config import GroupAgentConfig
from ..agents.teaching_agent import TAConfig, RAGMode

class AgentConfigService:
    @staticmethod
    def get_config_model(db: Session, group_id: int) -> GroupAgentConfig:
        """Fetch the DB model for config, creating default if missing."""
        config = db.query(GroupAgentConfig).filter(GroupAgentConfig.group_id == group_id).first()
        
        if not config:
            # Create default
            config = GroupAgentConfig(
                group_id=group_id,
                rag_mode=RAGMode.DOCUMENTS_ONLY.value,
                use_socratic_prompting=True,
                temperature=0.7,
                max_output_tokens=2048,
                limit_factual=1,
                limit_conceptual=2,
                limit_applied=2,
                limit_complex=3
            )
            db.add(config)
            db.commit()
            db.refresh(config)
            
        return config

    @staticmethod
    def get_ta_config(db: Session, group_id: int) -> TAConfig:
        """Convert DB model to the Agent's TAConfig dataclass."""
        db_config = AgentConfigService.get_config_model(db, group_id)
        
        return TAConfig(
            rag_mode=RAGMode(db_config.rag_mode),
            use_socratic_prompting=db_config.use_socratic_prompting,
            temperature=db_config.temperature,
            max_output_tokens=db_config.max_output_tokens,
            socratic_prompt_limit_factual=db_config.limit_factual,
            socratic_prompt_limit_conceptual=db_config.limit_conceptual,
            socratic_prompt_limit_applied=db_config.limit_applied,
            socratic_prompt_limit_complex=db_config.limit_complex
        )

    @staticmethod
    def update_config(db: Session, group_id: int, updates: dict):
        """Update specific fields."""
        config = AgentConfigService.get_config_model(db, group_id)
        
        for key, value in updates.items():
            if hasattr(config, key):
                setattr(config, key, value)
        
        db.commit()
        db.refresh(config)
        return config