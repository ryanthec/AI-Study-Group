// React and libraries
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout, Button, message, Modal, Spin } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';

// Services and components
import { Navbar } from '../../components/layout/Navbar';
import { studyGroupService } from '../../services/studyGroup.service';
import { InviteMemberModal } from '../../components/email/InviteMemberModal';

import { StudyGroupSidebar } from '../../components/studyGroup/StudyGroupSidebar';
import { GroupDetailsTab } from '../../components/studyGroup/GroupDetailsTab';
import { AgentSettingsTab } from '../../components/studyGroup/AgentSettingsTab';
import { ChatTab } from '../../components/studyGroup/ChatTab';
import { DocumentsTab } from '../../components/studyGroup/DocumentsTab';
import { QuizTab } from '../../components/studyGroup/QuizTab';


// Types and hooks
import type { StudyGroup } from '../../types/studyGroup.types';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../hooks/useTheme';


export const GroupDetailPage: React.FC = () => {
  
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isDark } = useTheme();

  // Group and Member related states
  const { groupId } = useParams<{ groupId: string }>();
  const [group, setGroup] = useState<StudyGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'chat' | 'documents' | 'agent settings' | 'quizzes'>('details');
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);

  useEffect(() => {
    if (groupId) {
      loadGroup();
      // loadMembers();
    }
  }, [groupId]);


  const loadGroup = async () => {
    try {
      setLoading(true);
      const data = await studyGroupService.getGroup(Number(groupId));
      setGroup(data);
    } catch (error) {
      message.error('Failed to load group');
      navigate('/groups');
    } finally {
      setLoading(false);
    }
  };

  // const loadMembers = async () => {
  //   try {
  //     setMembersLoading(true);
  //     const membersList = await studyGroupService.getGroupMembers(Number(groupId));
  //     setMembers(membersList);
  //     // Count online members
  //     const onlineCount = membersList.filter((m: any) => m.isOnline).length;
  //     setOnlineMembers(onlineCount);
  //   } catch (error) {
  //     console.log('Could not load members', error);
  //   } finally {
  //     setMembersLoading(false);
  //   }
  // };

   // Silent refresh without showing loading spinner
  // const loadMembersQuietly = async () => {
  //   try {
  //     const membersList = await studyGroupService.getGroupMembers(Number(groupId));
  //     setMembers(membersList);
  //     const onlineCount = membersList.filter((m: any) => m.isOnline).length;
  //     setOnlineMembers(onlineCount);
  //   } catch (error) {
  //     // Silently fail - don't show error to user
  //     console.log('Background member refresh failed', error);
  //   }
  // };

  const handleLeave = () => {
    Modal.confirm({
      title: 'Leave Study Group',
      content: 'Are you sure you want to leave this study group?',
      okText: 'Leave',
      okType: 'danger',
      onOk: async () => {
        try {
          await studyGroupService.leaveGroup(Number(groupId));
          message.success('Left the group successfully');
          navigate('/groups');
        } catch (error: any) {
          message.error(error.response?.data?.detail || 'Failed to leave group');
        }
      },
    });
  };

  const handleDelete = () => {
    Modal.confirm({
      title: 'Delete Study Group',
      content:
        'Are you sure you want to delete this study group? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await studyGroupService.deleteGroup(Number(groupId));
          message.success('Group deleted successfully');
          navigate('/groups');
        } catch (error: any) {
          message.error(error.response?.data?.detail || 'Failed to delete group');
        }
      },
    });
  };

  const handleEdit = () => {
    navigate(`/groups/${groupId}/edit`);
  };

  const handleBackToGroups = () => {
    navigate('/groups');
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'chat':
        return <ChatTab 
            groupId={Number(groupId)} 
            // Receive the list from ChatBox -> ChatTab -> Here
            onOnlineUsersUpdate={(users) => setOnlineUsers(users)} 
          />;
      case 'documents':
        return (
          <DocumentsTab
            groupId={Number(groupId)}
            isAdmin={group?.is_admin || false}
            currentUserId={user?.id || ''}
          />
        );
      case 'agent settings':
        return (
          <AgentSettingsTab
            groupId={Number(groupId)}
            isAdmin={group?.is_admin || false}
          />
        );
      case 'quizzes':
        return <QuizTab groupId={Number(groupId)} />;
        
      case 'details':
      default:
        return (
          <GroupDetailsTab
            group={group}
            loading={loading}
            members={members}
            membersLoading={membersLoading}
          />
        );
    }
  };


  return (
    <>
      <Navbar />

      {/* Sidebar Navigation */}
      {!loading && group && (
        <StudyGroupSidebar
          groupId={Number(groupId)}
          group={group}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onEdit={handleEdit}
          onInvite={() => setInviteModalVisible(true)}
          onDelete={handleDelete}
          onLeave={handleLeave}
          onBackToGroups={handleBackToGroups}
          onlineUsers={onlineUsers}
        />
      )}

      {/* Main Content - with proper margin for sidebar AND navbar */}
      <div
        style={{
          marginLeft: 200,
          marginTop: 0,
          minHeight: 'calc(100vh - 64px)',
          background: isDark ? '#141414' : '#f5f5f5',
          padding: 0,
        }}
      >
        {loading ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '400px',
            }}
          >
            <Spin size="large" />
          </div>
        ) : (
          renderContent()
        )}
      </div>

      {/* Invite Modal */}
      {group && (
        <InviteMemberModal
          visible={inviteModalVisible}
          groupId={Number(groupId)}
          onClose={() => setInviteModalVisible(false)}
          onSuccess={() => {
            // loadMembers();
            setInviteModalVisible(false);
          }}
        />
      )}
    </>
  );
};