#!/usr/bin/env python3
"""
Parse and represent Claude Code configuration from ~/.claude.json

This module provides dataclasses to represent the Claude configuration
and utilities to parse the JSON file.
"""

import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional


@dataclass
class SkillUsageStats:
    """Usage statistics for a single skill."""
    skill_name: str
    usage_count: int
    last_used_at: datetime

    @classmethod
    def from_dict(cls, skill_name: str, data: dict) -> 'SkillUsageStats':
        """Create from dictionary representation."""
        return cls(
            skill_name=skill_name,
            usage_count=data.get('usageCount', 0),
            last_used_at=datetime.fromtimestamp(data.get('lastUsedAt', 0) / 1000)
        )

    @property
    def days_since_last_use(self) -> int:
        """Calculate days since last use."""
        return (datetime.now() - self.last_used_at).days


@dataclass
class TipsHistory:
    """Tips that have been shown to the user."""
    tips: Dict[str, int] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict) -> 'TipsHistory':
        """Create from dictionary representation."""
        return cls(tips=data)


@dataclass
class FeatureFlags:
    """Feature flags and gates."""
    statsig_gates: Dict[str, bool] = field(default_factory=dict)
    growthbook_features: Dict[str, any] = field(default_factory=dict)
    dynamic_configs: Dict[str, any] = field(default_factory=dict)

    @classmethod
    def from_dict(cls, data: dict) -> 'FeatureFlags':
        """Create from dictionary representation."""
        return cls(
            statsig_gates=data.get('cachedStatsigGates', {}),
            growthbook_features=data.get('cachedGrowthBookFeatures', {}),
            dynamic_configs=data.get('cachedDynamicConfigs', {})
        )


@dataclass
class MCPServers:
    """MCP (Model Context Protocol) server configuration."""
    enabled: List[str] = field(default_factory=list)
    disabled: List[str] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: dict) -> 'MCPServers':
        """Create from dictionary representation."""
        return cls(
            enabled=data.get('enabledMcpjsonServers', []),
            disabled=data.get('disabledMcpjsonServers', [])
        )


@dataclass
class ClaudeConfig:
    """Complete Claude Code configuration from ~/.claude.json"""

    # Usage statistics
    num_startups: int
    skill_usage: Dict[str, SkillUsageStats]
    memory_usage_count: int
    prompt_queue_use_count: int

    # User preferences
    theme: str
    install_method: str
    auto_updates: bool

    # Feature state
    has_completed_onboarding: bool
    has_seen_tasks_hint: bool
    has_used_stash: bool
    tips_history: TipsHistory

    # Feature flags
    feature_flags: FeatureFlags

    # MCP configuration
    mcp_servers: MCPServers

    # GitHub repositories
    github_repo_paths: List[str] = field(default_factory=list)

    # Raw data (for fields we don't explicitly model)
    raw_data: dict = field(default_factory=dict)

    @classmethod
    def from_file(cls, path: Path = None) -> 'ClaudeConfig':
        """Load Claude configuration from ~/.claude.json

        Args:
            path: Path to .claude.json file (defaults to ~/.claude.json)

        Returns:
            ClaudeConfig instance
        """
        if path is None:
            path = Path.home() / '.claude.json'

        with open(path) as f:
            data = json.load(f)

        return cls.from_dict(data)

    @classmethod
    def from_dict(cls, data: dict) -> 'ClaudeConfig':
        """Create from dictionary representation."""

        # Parse skill usage statistics
        skill_usage = {}
        for skill_name, stats in data.get('skillUsage', {}).items():
            skill_usage[skill_name] = SkillUsageStats.from_dict(skill_name, stats)

        return cls(
            num_startups=data.get('numStartups', 0),
            skill_usage=skill_usage,
            memory_usage_count=data.get('memoryUsageCount', 0),
            prompt_queue_use_count=data.get('promptQueueUseCount', 0),
            theme=data.get('theme', 'dark'),
            install_method=data.get('installMethod', 'unknown'),
            auto_updates=data.get('autoUpdates', False),
            has_completed_onboarding=data.get('hasCompletedOnboarding', False),
            has_seen_tasks_hint=data.get('hasSeenTasksHint', False),
            has_used_stash=data.get('hasUsedStash', False),
            tips_history=TipsHistory.from_dict(data.get('tipsHistory', {})),
            feature_flags=FeatureFlags.from_dict(data),
            mcp_servers=MCPServers.from_dict(data),
            github_repo_paths=data.get('githubRepoPaths', []),
            raw_data=data
        )

    def get_most_used_skills(self, limit: int = 10) -> List[SkillUsageStats]:
        """Get most frequently used skills.

        Args:
            limit: Maximum number of skills to return

        Returns:
            List of SkillUsageStats sorted by usage count (descending)
        """
        return sorted(
            self.skill_usage.values(),
            key=lambda s: s.usage_count,
            reverse=True
        )[:limit]

    def get_recently_used_skills(self, days: int = 30, limit: int = 10) -> List[SkillUsageStats]:
        """Get recently used skills.

        Args:
            days: Only include skills used within this many days
            limit: Maximum number of skills to return

        Returns:
            List of SkillUsageStats sorted by last used date (descending)
        """
        recent = [
            stats for stats in self.skill_usage.values()
            if stats.days_since_last_use <= days
        ]
        return sorted(recent, key=lambda s: s.last_used_at, reverse=True)[:limit]

    def get_skill_stats(self, skill_name: str) -> Optional[SkillUsageStats]:
        """Get usage statistics for a specific skill.

        Args:
            skill_name: Name of the skill

        Returns:
            SkillUsageStats if found, None otherwise
        """
        return self.skill_usage.get(skill_name)


def main():
    """Example usage."""
    config = ClaudeConfig.from_file()

    print(f"Claude Code Configuration")
    print(f"Startups: {config.num_startups}")
    print(f"Theme: {config.theme}")
    print(f"\nMost Used Skills:")
    for stats in config.get_most_used_skills(10):
        print(f"  {stats.skill_name}: {stats.usage_count} uses, "
              f"last used {stats.days_since_last_use} days ago")


if __name__ == '__main__':
    main()
